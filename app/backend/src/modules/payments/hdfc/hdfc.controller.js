const { prisma, redisClient } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { onOrderPlaced } = require('../../../services/orderEmail.service');
const { generateInvoiceAsync } = require('../../../services/invoice.service');
const { createHdfcOrder, initiateUpiIntent, buildUpiIntentUri, getHdfcOrderStatus } = require('./hdfc.service');

const FRONTEND_URL = process.env.CUSTOMER_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Generate a short alphanumeric order ID for HDFC (max 21 chars, no special chars).
 */
function generateHdfcOrderId() {
    return `H${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 21).toUpperCase();
}

/**
 * POST /api/v1/payments/hdfc/upi-intent
 * Creates a pending order and initiates a UPI intent transaction with HDFC.
 * Returns the UPI intent URI (upi://pay?...) for the frontend to render as QR / deep link.
 */
exports.initiateUpiPayment = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { shippingAddress } = req.body;
        const cartKey = `cart:${userId}`;

        // 1. Get cart from Redis
        const cartItems = await redisClient.hGetAll(cartKey);
        if (!cartItems || Object.keys(cartItems).length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        // 2. Validate stock and build order items
        const dbOrderItems = [];
        let subtotal = 0;

        for (const [sku, quantity] of Object.entries(cartItems)) {
            const variant = await prisma.productVariant.findUnique({
                where: { sku },
                include: { product: true, inventory: true },
            });

            if (!variant) continue;

            if (variant.inventory.quantity < parseInt(quantity)) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${variant.product.name}`,
                });
            }

            const unitPrice = parseFloat(variant.product.basePrice) + parseFloat(variant.priceAdjustment);
            const totalItemPrice = unitPrice * parseInt(quantity);
            subtotal += totalItemPrice;

            dbOrderItems.push({
                productId: variant.productId,
                variantId: variant.id,
                productName: variant.product.name,
                variantName: variant.name,
                sku: variant.sku,
                quantity: parseInt(quantity),
                unitPrice,
                totalPrice: totalItemPrice,
            });
        }

        if (dbOrderItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid items in cart' });
        }

        // 3. Create our DB order (PENDING)
        const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const order = await prisma.order.create({
            data: {
                orderNumber,
                userId,
                status: 'PENDING',
                paymentMethod: 'UPI',
                subtotal,
                total: subtotal,
                shippingAddress: shippingAddress || {},
                items: { create: dbOrderItems },
            },
        });

        // 4. Register order with HDFC
        const hdfcOrderId = generateHdfcOrderId();
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, phone: true },
        });

        await createHdfcOrder({
            hdfcOrderId,
            amount: subtotal,
            customerId: userId,
            customerEmail: user.email,
            customerPhone: user.phone || '',
            returnUrl: `${process.env.BACKEND_PUBLIC_URL}/api/v1/payments/hdfc/return`,
        });

        // 5. Initiate UPI intent — get sdk_params
        const txnResponse = await initiateUpiIntent({ hdfcOrderId, customerId: userId });
        const sdkParams = txnResponse.sdk_params || txnResponse.payment?.sdk_params || {};
        const upiIntentUri = buildUpiIntentUri(sdkParams);

        // 6. Store HDFC payment record
        await prisma.hdfcPayment.create({
            data: {
                orderId: order.id,
                hdfcOrderId,
                txnId: txnResponse.txn_id || null,
                txnUuid: txnResponse.txn_uuid || null,
                status: txnResponse.status || 'PENDING',
                upiIntentUri,
                sdkParams,
            },
        });

        return res.status(200).json({
            success: true,
            orderId: order.id,
            hdfcOrderId,
            upiIntentUri,
            sdkParams,
        });
    } catch (error) {
        logger.error(`HDFC UPI initiate error: ${error.message}`);
        next(error);
    }
};

/**
 * POST /api/v1/payments/hdfc/webhook
 * HDFC posts payment status here after the customer completes (or fails) the UPI payment.
 * No auth — HDFC hits this directly. Always verify status via order status API before fulfilling.
 */
exports.handleWebhook = async (req, res, next) => {
    try {
        // ── Log every hit immediately — before any processing ────────────────
        logger.info({
            event:   '[HDFC] WEBHOOK HIT',
            method:  req.method,
            path:    req.path,
            ip:      req.ip,
            headers: {
                authorization:   req.headers['authorization'] ? '***present***' : 'MISSING',
                'content-type':  req.headers['content-type'],
                'x-merchantid':  req.headers['x-merchantid'],
            },
            body: req.body,
        }, '[HDFC] ========== WEBHOOK RECEIVED ==========');

        // ── Verify HDFC Basic Auth (configured in HDFC Dashboard → Settings → Webhook) ──
        const webhookUser = process.env.HDFC_WEBHOOK_USERNAME;
        const webhookPass = process.env.HDFC_WEBHOOK_PASSWORD;
        if (webhookUser && webhookPass) {
            const authHeader = req.headers['authorization'] || '';
            const expected   = `Basic ${Buffer.from(`${webhookUser}:${webhookPass}`).toString('base64')}`;
            if (authHeader !== expected) {
                logger.warn('[HDFC] webhook: invalid Basic Auth — request rejected');
                return res.status(200).json({ received: true }); // always 200 so HDFC doesn't retry bad requests
            }
        }

        const payload = req.body;
        logger.info({ payload }, '[HDFC] webhook received');

        // HDFC sends two different webhook shapes:
        // TXN_CHARGED    → content.txn.order_id, content.txn.status, content.txn.payment_gateway_response.rrn
        // ORDER_SUCCEEDED → content.order.order_id, content.order.status, content.order.txn_detail.*, content.order.payment_gateway_response.rrn
        // Flat fallback   → payload.order_id, payload.status (older integrations)
        const txnContent   = payload.content?.txn   || {};
        const orderContent = payload.content?.order || {};
        // Prefer txn, fall back to order, then flat
        const hdfcOrderId = txnContent.order_id   || orderContent.order_id   || payload.order_id || null;
        const hdfcStatus  = txnContent.status      || orderContent.status     || payload.status   || null;
        const hdfcTxnId   = txnContent.txn_id      || orderContent.txn_id     || orderContent.txn_detail?.txn_id   || payload.txn_id  || null;
        const hdfcUtr     = txnContent.payment_gateway_response?.rrn
                         || orderContent.payment_gateway_response?.rrn
                         || payload.utr || null;
        const hdfcAmount  = txnContent.txn_amount  || txnContent.net_amount
                         || orderContent.amount     || orderContent.txn_detail?.txn_amount
                         || payload.amount || null;

        logger.info({ hdfcOrderId, hdfcStatus, hdfcTxnId, hdfcUtr, hdfcAmount }, '[HDFC] webhook: extracted fields');

        if (!hdfcOrderId) {
            logger.warn('[HDFC] webhook: missing order_id in payload');
            return res.status(200).json({ received: true }); // always 200 to HDFC
        }

        const TERMINAL_STATUSES  = ['CHARGED', 'AUTHORIZATION_FAILED', 'AUTHENTICATION_FAILED', 'JUSPAY_DECLINED'];
        const FAILURE_STATUSES   = ['AUTHORIZATION_FAILED', 'AUTHENTICATION_FAILED', 'JUSPAY_DECLINED'];

        // ── Try AccuzpayPayment first (external UPI / payment-gateway flow) ──
        const accuzpayPayment = await prisma.accuzpayPayment.findUnique({ where: { hdfcOrderId } });
        if (accuzpayPayment) {
            logger.info({ hdfcOrderId, hdfcStatus }, '[HDFC] webhook → routing to AccuzpayPayment handler');

            if (accuzpayPayment.status === 'FORWARDED') {
                logger.info(`[HDFC] webhook: accuzpay ${hdfcOrderId} already forwarded — skipping`);
                return res.status(200).json({ received: true });
            }

            // Verify live status server-side
            let liveStatus = hdfcStatus;
            try {
                const hdfcData = await getHdfcOrderStatus(hdfcOrderId, accuzpayPayment.customerId);
                liveStatus = hdfcData.status || hdfcStatus;
                logger.info({ hdfcOrderId, liveStatus }, '[HDFC] webhook: accuzpay server-side status verified');
            } catch (err) {
                logger.error(`[HDFC] webhook: accuzpay status check failed — ${err.message}, using payload status`);
            }

            if (!TERMINAL_STATUSES.includes(liveStatus)) {
                await prisma.accuzpayPayment.update({ where: { hdfcOrderId }, data: { status: liveStatus } });
                logger.info(`[HDFC] webhook: accuzpay intermediate status ${liveStatus} — not forwarding yet`);
                return res.status(200).json({ received: true });
            }

            const accuzpayStatus = liveStatus === 'CHARGED' ? 'TXN' : 'FAILED';
            await prisma.accuzpayPayment.update({ where: { hdfcOrderId }, data: { status: liveStatus } });

            // Forward to PayVex/Accuzpay callback URL
            // PayVex hdfcCallback expects: POST { reference_id, status, utr, amount } + header x-api-key
            try {
                const axios = require('axios');
                const callbackPayload = {
                    reference_id: accuzpayPayment.referenceId,
                    status:       accuzpayStatus,      // 'TXN' (success) or 'FAILED'
                    utr:          hdfcUtr || hdfcTxnId || null,  // RRN preferred, fallback txn_id
                    amount:       parseFloat(accuzpayPayment.amount),
                };
                logger.info({ callbackUrl: accuzpayPayment.callbackUrl, callbackPayload }, '[HDFC] webhook: forwarding to PayVex');
                await axios.post(
                    accuzpayPayment.callbackUrl,
                    callbackPayload,
                    {
                        headers: { 'x-api-key': process.env.ACCUZPAY_SHARED_SECRET, 'Content-Type': 'application/json' },
                        timeout: 10000,
                    }
                );
                await prisma.accuzpayPayment.update({ where: { hdfcOrderId }, data: { status: 'FORWARDED', forwardedAt: new Date() } });
                logger.info(`[HDFC] webhook: accuzpay forwarded ✅ — referenceId=${accuzpayPayment.referenceId} status=${accuzpayStatus} utr=${hdfcUtr}`);
            } catch (fwdErr) {
                logger.error(`[HDFC] webhook: accuzpay forward failed — ${fwdErr.message}`);
            }

            return res.status(200).json({ received: true });
        }

        // ── Fall through to HdfcPayment (store checkout orders) ──────────────
        const hdfcPayment = await prisma.hdfcPayment.findUnique({
            where: { hdfcOrderId },
            include: { order: { include: { user: true, items: true } } },
        });

        if (!hdfcPayment) {
            logger.warn(`[HDFC] webhook: no HdfcPayment or AccuzpayPayment found for hdfcOrderId=${hdfcOrderId}`);
            return res.status(200).json({ received: true });
        }

        // Map HDFC status to our order status
        if (hdfcStatus === 'CHARGED') {
            // Duplicate entry validation — skip if already processed (webhook may fire more than once)
            const alreadyProcessed =
                hdfcPayment.order.status === 'PROCESSING' &&
                hdfcPayment.order.paymentStatus === 'paid';

            if (alreadyProcessed) {
                logger.info(`HDFC webhook: order ${hdfcPayment.orderId} already PROCESSING — duplicate webhook ignored`);
                return res.status(200).json({ received: true });
            }

            await prisma.$transaction([
                prisma.hdfcPayment.update({
                    where: { hdfcOrderId },
                    data: { status: hdfcStatus, txnId: hdfcTxnId || hdfcPayment.txnId },
                }),
                prisma.order.update({
                    where: { id: hdfcPayment.orderId },
                    data: {
                        status: 'PROCESSING',
                        paymentStatus: 'paid',
                        paymentIntentId: hdfcPayment.txnUuid,
                    },
                }),
            ]);

            // Clear server-side cart
            if (hdfcPayment.order.userId) {
                await redisClient.del(`cart:${hdfcPayment.order.userId}`);
            }

            // Send order confirmation email and generate invoice (non-blocking)
            if (hdfcPayment.order) {
                onOrderPlaced(hdfcPayment.order);
                generateInvoiceAsync(hdfcPayment.order);
            }

            logger.info(`HDFC: Order ${hdfcPayment.orderId} paid and moved to PROCESSING`);
        } else if (FAILURE_STATUSES.includes(hdfcStatus)) {
            await prisma.$transaction([
                prisma.hdfcPayment.update({
                    where: { hdfcOrderId },
                    data: { status: hdfcStatus },
                }),
                prisma.order.update({
                    where: { id: hdfcPayment.orderId },
                    data: { paymentStatus: 'failed' },
                }),
            ]);
            logger.warn(`HDFC: Order ${hdfcPayment.orderId} payment failed — status: ${hdfcStatus}`);
        } else {
            // Intermediate statuses (PENDING_VBV etc.) — just update the HDFC record
            await prisma.hdfcPayment.update({
                where: { hdfcOrderId },
                data: { status: hdfcStatus },
            });
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        logger.error(`HDFC webhook error: ${error.message}`);
        next(error);
    }
};

/**
 * GET /api/v1/payments/hdfc/status/:orderId
 * Polls HDFC for the latest payment status of a given order (our DB order ID).
 * Frontend calls this while the user is on the QR/intent waiting screen.
 */
exports.checkPaymentStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        const hdfcPayment = await prisma.hdfcPayment.findUnique({
            where: { orderId },
            include: {
                order: {
                    include: {
                        user: true,
                        items: true,
                    },
                },
            },
        });

        if (!hdfcPayment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        // Ensure order belongs to requesting user
        if (hdfcPayment.order.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        // Fetch live status from HDFC — log full response for bank verification records
        const hdfcData = await getHdfcOrderStatus(hdfcPayment.hdfcOrderId, userId);
        const latestStatus = hdfcData.status;

        // txn_id may arrive in the order status response after payment completes
        const latestTxnId = hdfcData.txn_id || hdfcData.txnId || hdfcPayment.txnId || null;

        logger.info({
            hdfcOrderId: hdfcPayment.hdfcOrderId,
            ourOrderId: orderId,
            orderNumber: hdfcPayment.order.orderNumber,
            hdfcRawResponse: hdfcData,
        }, '[HDFC] Order Status API response');

        const isPaid = latestStatus === 'CHARGED';
        const alreadyProcessed =
            hdfcPayment.order.status === 'PROCESSING' &&
            hdfcPayment.order.paymentStatus === 'paid';

        if (isPaid && !alreadyProcessed) {
            // Payment confirmed via polling — update order + hdfcPayment atomically
            await prisma.$transaction([
                prisma.hdfcPayment.update({
                    where: { orderId },
                    data: {
                        status: latestStatus,
                        ...(latestTxnId ? { txnId: latestTxnId } : {}),
                    },
                }),
                prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'PROCESSING', paymentStatus: 'paid' },
                }),
            ]);

            // Clear the server-side cart
            await redisClient.del(`cart:${userId}`);

            // Send order confirmation email and generate invoice (non-blocking)
            onOrderPlaced(hdfcPayment.order);
            generateInvoiceAsync(hdfcPayment.order);

            logger.info(`[HDFC] checkPaymentStatus: order ${orderId} marked PROCESSING (detected via polling)`);
        } else if (latestStatus && latestStatus !== hdfcPayment.status) {
            // Intermediate status change — just keep hdfcPayment in sync
            await prisma.hdfcPayment.update({
                where: { orderId },
                data: {
                    status: latestStatus,
                    ...(latestTxnId && latestTxnId !== hdfcPayment.txnId ? { txnId: latestTxnId } : {}),
                },
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                orderId,
                orderNumber: hdfcPayment.order.orderNumber,
                hdfcOrderId: hdfcPayment.hdfcOrderId,
                amount: Number(hdfcPayment.order.total),
                paymentMethod: hdfcPayment.order.paymentMethod,
                status: latestStatus || hdfcPayment.status,
                paid: isPaid,
                hdfcRawResponse: hdfcData,
            },
        });
    } catch (error) {
        logger.error(`HDFC status check error: ${error.message}`);
        next(error);
    }
};

/**
 * POST /api/v1/payments/hdfc/return
 * HDFC POSTs here after the customer completes (or cancels) card/NB payment on Hypercheckout.
 * We verify the status server-side, update the order, then redirect the browser to the frontend.
 */
exports.handleReturn = async (req, res, next) => {
    try {
        const payload = req.body;
        logger.info({ payload }, '[HDFC] return URL POST received');

        // HDFC sends order_id (their internal ID) or our order_id depending on integration
        const hdfcOrderId = payload.order_id;
        const frontendBase = FRONTEND_URL;

        if (!hdfcOrderId) {
            logger.warn('[HDFC] return URL missing order_id — redirecting to failure');
            return res.redirect(`${frontendBase}/payment/hdfc/callback?status=failed`);
        }

        const hdfcPayment = await prisma.hdfcPayment.findUnique({
            where: { hdfcOrderId },
            include: { order: { include: { user: true, items: true } } },
        });

        if (!hdfcPayment) {
            logger.warn(`[HDFC] return: no HdfcPayment for hdfcOrderId=${hdfcOrderId}`);
            return res.redirect(`${frontendBase}/payment/hdfc/callback?status=failed`);
        }

        // Always verify with HDFC server-side — never trust POST body alone
        let liveStatus = null;
        let hdfcRawResponse = null;
        try {
            hdfcRawResponse = await getHdfcOrderStatus(hdfcOrderId, hdfcPayment.order.userId);
            liveStatus = hdfcRawResponse.status;
            logger.info({
                hdfcOrderId,
                ourOrderId: hdfcPayment.orderId,
                orderNumber: hdfcPayment.order.orderNumber,
                liveStatus,
                hdfcRawResponse,
            }, '[HDFC] return: Order Status API response (bank verification log)');
        } catch (err) {
            logger.error(`[HDFC] return: status check failed — ${err.message}`);
        }

        const isPaid = liveStatus === 'CHARGED';

        if (isPaid) {
            await prisma.$transaction([
                prisma.hdfcPayment.update({
                    where: { hdfcOrderId },
                    data: { status: liveStatus },
                }),
                prisma.order.update({
                    where: { id: hdfcPayment.orderId },
                    data: { status: 'PROCESSING', paymentStatus: 'paid' },
                }),
            ]);

            if (hdfcPayment.order?.userId) {
                await redisClient.del(`cart:${hdfcPayment.order.userId}`);
            }
            if (hdfcPayment.order) {
                onOrderPlaced(hdfcPayment.order);
                generateInvoiceAsync(hdfcPayment.order);
            }

            logger.info(`[HDFC] return: order ${hdfcPayment.orderId} marked PROCESSING`);
        } else if (liveStatus) {
            await prisma.hdfcPayment.update({
                where: { hdfcOrderId },
                data: { status: liveStatus },
            });
        }

        const status = isPaid ? 'success' : 'failed';
        const amount = Number(hdfcPayment.order.total).toFixed(2);
        const orderNumber = encodeURIComponent(hdfcPayment.order.orderNumber);
        const encodedHdfcOrderId = encodeURIComponent(hdfcOrderId);

        return res.redirect(
            `${frontendBase}/payment/hdfc/callback?orderId=${hdfcPayment.orderId}&status=${status}&hdfcOrderId=${encodedHdfcOrderId}&amount=${amount}&orderNumber=${orderNumber}`
        );
    } catch (error) {
        logger.error(`[HDFC] handleReturn error: ${error.message}`);
        const frontendBase = FRONTEND_URL;
        return res.redirect(`${frontendBase}/payment/hdfc/callback?status=failed`);
    }
};
