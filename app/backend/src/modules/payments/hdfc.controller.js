const { prisma, redisClient } = require('../../config/database');
const logger = require('../../utils/logger');
const { onOrderPlaced } = require('../../services/orderEmail.service');
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
            returnUrl: `${process.env.CUSTOMER_FRONTEND_URL}/payment/hdfc/callback`,
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
        const payload = req.body;
        logger.info(`HDFC webhook received: ${JSON.stringify(payload)}`);

        const hdfcOrderId = payload.order_id || payload.id;
        const hdfcStatus = payload.status;

        if (!hdfcOrderId) {
            return res.status(400).json({ success: false, message: 'Missing order_id in webhook payload' });
        }

        const hdfcPayment = await prisma.hdfcPayment.findUnique({
            where: { hdfcOrderId },
            include: { order: { include: { user: true, items: true } } },
        });

        if (!hdfcPayment) {
            logger.warn(`HDFC webhook: no HdfcPayment found for hdfcOrderId=${hdfcOrderId}`);
            return res.status(200).json({ received: true });
        }

        // Map HDFC status to our order status
        if (hdfcStatus === 'CHARGED') {
            await prisma.$transaction([
                prisma.hdfcPayment.update({
                    where: { hdfcOrderId },
                    data: { status: hdfcStatus, txnId: payload.txn_id || hdfcPayment.txnId },
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

            // Clear cart
            if (hdfcPayment.order.userId) {
                await redisClient.del(`cart:${hdfcPayment.order.userId}`);
            }

            // Send order confirmation email
            if (hdfcPayment.order) {
                onOrderPlaced(hdfcPayment.order);
            }

            logger.info(`HDFC: Order ${hdfcPayment.orderId} paid and moved to PROCESSING`);
        } else if (['AUTHORIZATION_FAILED', 'AUTHENTICATION_FAILED', 'JUSPAY_DECLINED'].includes(hdfcStatus)) {
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
            include: { order: { select: { userId: true } } },
        });

        if (!hdfcPayment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        // Ensure order belongs to requesting user
        if (hdfcPayment.order.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        // Fetch live status from HDFC
        const hdfcData = await getHdfcOrderStatus(hdfcPayment.hdfcOrderId, userId);
        const latestStatus = hdfcData.status;

        // Sync status locally if it changed
        if (latestStatus && latestStatus !== hdfcPayment.status) {
            await prisma.hdfcPayment.update({
                where: { orderId },
                data: { status: latestStatus },
            });
        }

        return res.status(200).json({
            success: true,
            orderId,
            hdfcOrderId: hdfcPayment.hdfcOrderId,
            status: latestStatus || hdfcPayment.status,
            paid: latestStatus === 'CHARGED',
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
        try {
            const hdfcData = await getHdfcOrderStatus(hdfcOrderId, hdfcPayment.order.userId);
            liveStatus = hdfcData.status;
            logger.info({ hdfcOrderId, liveStatus }, '[HDFC] return: live status from HDFC');
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
            }

            logger.info(`[HDFC] return: order ${hdfcPayment.orderId} marked PROCESSING`);
        } else if (liveStatus) {
            await prisma.hdfcPayment.update({
                where: { hdfcOrderId },
                data: { status: liveStatus },
            });
        }

        const status = isPaid ? 'success' : 'failed';
        return res.redirect(`${frontendBase}/payment/hdfc/callback?orderId=${hdfcPayment.orderId}&status=${status}`);
    } catch (error) {
        logger.error(`[HDFC] handleReturn error: ${error.message}`);
        const frontendBase = FRONTEND_URL;
        return res.redirect(`${frontendBase}/payment/hdfc/callback?status=failed`);
    }
};
