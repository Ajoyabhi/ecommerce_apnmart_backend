/**
 * checkout.controller.js
 * ----------------------
 * Handles the checkout and COD OTP endpoints only.
 * Kept separate from user.controller.js so the bank-submitted SHA-256 hash
 * of this file remains stable — any unrelated user feature changes do not
 * affect the payment code hash.
 *
 * Routes (defined in user.routes.js):
 *   POST /api/v1/user/orders/request-cod-otp  →  exports.requestCodOtp
 *   POST /api/v1/user/orders/checkout          →  exports.checkout
 */

const { z } = require('zod');
const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { verifyCodOtp, createAndSendCodOtp } = require('../../services/codOtp.service');
const { onOrderPlaced } = require('../../services/orderEmail.service');
const { generateInvoiceAsync } = require('../../services/invoice.service');
const { createHdfcOrder, initiateUpiIntent, buildUpiIntentUri } = require('../payments/hdfc/hdfc.service');

// ─── Shipping / Tax constants ─────────────────────────────────────────────────
const TAX_RATE = 0.0;
const FREE_SHIPPING_THRESHOLD = 500; // orders below this get flat shipping charge
const SHIPPING_COST = 50;            // flat shipping charge in INR

// ─── Helpers ─────────────────────────────────────────────────────────────────
function decimalToNumber(d) {
    if (d === null || d === undefined) return 0;
    if (typeof d === 'number') return d;
    return Number(d);
}

function parseDecimal(d) {
    if (d == null) return 0;
    if (typeof d === 'number') return d;
    const n = parseFloat(String(d));
    return Number.isFinite(n) ? n : 0;
}

function generateHdfcOrderId() {
    return `H${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
        .slice(0, 21)
        .toUpperCase();
}

// ─── Validation Schemas ───────────────────────────────────────────────────────
const checkoutAddressSchema = z.object({
    fullName:       z.string().min(1, 'fullName is required'),
    phone:          z.string().min(1, 'phone is required'),
    email:          z.string().email('Invalid email'),
    addressLine1:   z.string().min(1, 'addressLine1 is required'),
    addressLine2:   z.string().optional(),
    pincode:        z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
    postOfficeName: z.string().optional(),
    city:           z.string().min(1, 'city is required'),
    state:          z.string().min(1, 'state is required'),
    country:        z.string().min(1, 'country is required'),
});

const checkoutItemSchema = z.object({
    productId:    z.string().uuid(),
    productName:  z.string().min(1),
    productImage: z.string().optional(),
    sku:          z.string().min(1),
    quantity:     z.number().int().positive(),
    price:        z.number(), // ignored — backend recalculates from DB
    color:        z.string().optional(),
    size:         z.string().optional(),
});

const checkoutBodySchema = z.object({
    shippingAddress: checkoutAddressSchema,
    billingAddress:  checkoutAddressSchema.optional(),
    sameAsBilling:   z.boolean().optional().default(true),
    paymentMethod:   z.enum(['cod', 'card', 'upi', 'netbanking']).optional(),
    codOtp:          z.string().length(6).optional(), // required when paymentMethod === 'cod'
    items:           z.array(checkoutItemSchema).min(1, 'Cart is empty'),
    subtotal:        z.number().optional(),
    shippingCost:    z.number().optional(),
    tax:             z.number().optional(),
    total:           z.number().optional(),
});

// ─── Request COD OTP ──────────────────────────────────────────────────────────
// POST /api/v1/user/orders/request-cod-otp
exports.requestCodOtp = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { otpId, expiresAt } = await createAndSendCodOtp(userId, null);
        res.status(200).json({
            success: true,
            message: 'OTP sent to your registered email. Valid for 5 minutes.',
            data: { otpId, expiresAt: expiresAt.toISOString() },
        });
    } catch (error) {
        if (error.status === 404) {
            return res.status(404).json({ success: false, message: error.message });
        }
        if (error.status === 429) {
            return res.status(429).json({ success: false, message: error.message });
        }
        next(error);
    }
};

// ─── Checkout ─────────────────────────────────────────────────────────────────
// POST /api/v1/user/orders/checkout
exports.checkout = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const payload = checkoutBodySchema.parse(req.body);

        if (!payload.items || payload.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const shippingAddress = payload.shippingAddress;
        const phoneDigits = (shippingAddress.phone || '').replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Shipping address: phone must have at least 10 digits',
            });
        }

        let billingAddress = payload.sameAsBilling ? { ...shippingAddress } : payload.billingAddress;
        if (!payload.sameAsBilling && billingAddress) {
            const billingDigits = (billingAddress.phone || '').replace(/\D/g, '');
            if (billingDigits.length < 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Billing address: phone must have at least 10 digits',
                });
            }
        }
        if (!billingAddress) billingAddress = { ...shippingAddress };

        // ── 1. Validate items + recalculate prices from DB ──────────────────
        const validatedItems = [];
        let calculatedSubtotal = 0;

        for (const it of payload.items) {
            const product = await prisma.product.findUnique({
                where: { id: it.productId },
                include: {
                    variants: {
                        where: { isActive: true },
                        include: { inventory: true },
                    },
                },
            });

            if (!product) {
                return res.status(422).json({
                    success: false,
                    message: `Product not found: ${it.productId}. Your cart may contain items from an older session—please clear your cart and add products again.`,
                });
            }

            if (product.status !== 'published') {
                return res.status(422).json({
                    success: false,
                    message: `Product is not available: ${product.name}`,
                });
            }

            let unitPrice = parseDecimal(product.basePrice);
            let variantId = null;
            let variantName = null;
            let inventoryQty = 0;
            const isProductSku = it.sku === product.sku;

            if (it.sku && !isProductSku) {
                const variant = product.variants.find((v) => v.sku === it.sku);
                if (!variant || !variant.isActive) {
                    return res.status(422).json({
                        success: false,
                        message: `Variant not found or inactive: ${it.sku}. Please refresh the product and add to cart again with a valid option.`,
                    });
                }
                unitPrice = parseDecimal(product.basePrice) + parseDecimal(variant.priceAdjustment);
                variantId = variant.id;
                variantName = variant.name;
                inventoryQty = variant.inventory
                    ? variant.inventory.quantity - (variant.inventory.reservedQty || 0)
                    : 0;
            } else {
                const totalVariantStock = product.variants.reduce((sum, v) => {
                    const inv = v.inventory;
                    return sum + (inv ? inv.quantity - (inv.reservedQty || 0) : 0);
                }, 0);
                inventoryQty = totalVariantStock;
                if (product.variants.length > 0) {
                    variantName = product.variants[0].name;
                }
            }

            if (inventoryQty < it.quantity) {
                return res.status(422).json({
                    success: false,
                    message: `Insufficient stock for: ${product.name}`,
                });
            }

            const itemTotal = unitPrice * it.quantity;
            calculatedSubtotal += itemTotal;
            validatedItems.push({
                productId:    product.id,
                productName:  product.name,
                productImage: it.productImage || null,
                sku:          it.sku,
                quantity:     it.quantity,
                unitPrice,
                totalPrice:   itemTotal,
                variantId,
                variantName,
                color:        it.color || null,
                size:         it.size || null,
            });
        }

        // ── 2. Calculate order totals (server-side — never trust client) ────
        const taxAmount = TAX_RATE * calculatedSubtotal;
        const shippingAmount = calculatedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
        const total = Math.round((calculatedSubtotal + shippingAmount + taxAmount) * 100) / 100;

        const paymentMethod = payload.paymentMethod || 'cod';
        const initialStatus = paymentMethod === 'cod' ? 'CONFIRMED' : 'PENDING';
        const paymentStatus = paymentMethod === 'cod' ? 'paid' : 'unpaid';

        // ── 3. COD OTP verification ──────────────────────────────────────────
        if (paymentMethod === 'cod') {
            const codOtp = payload.codOtp;
            if (!codOtp || !/^\d{6}$/.test(codOtp)) {
                return res.status(400).json({
                    success: false,
                    message: 'COD requires a 6-digit OTP. Request OTP first via POST /api/v1/user/orders/request-cod-otp',
                });
            }
            const verification = await verifyCodOtp(userId, codOtp);
            if (!verification.valid) {
                return res.status(400).json({
                    success: false,
                    message: verification.error || 'Invalid or expired OTP',
                });
            }
        }

        // ── 4. Create order + items + decrement inventory (atomic) ───────────
        const order = await prisma.$transaction(async (tx) => {
            const year = new Date().getFullYear();
            const prefix = `ORD-${year}-`;
            const last = await tx.order.findFirst({
                where: { orderNumber: { startsWith: prefix } },
                orderBy: { orderNumber: 'desc' },
                select: { orderNumber: true },
            });
            const nextNum = last
                ? parseInt(last.orderNumber.slice(prefix.length), 10) + 1
                : 1;
            const orderNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;

            const newOrder = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    status:        initialStatus,
                    paymentStatus,
                    paymentMethod,
                    subtotal:      calculatedSubtotal,
                    taxAmount,
                    shippingAmount,
                    total,
                    shippingAddress,
                    billingAddress,
                    sameAsBilling: !!payload.sameAsBilling,
                    returnEligible: true,
                },
            });

            for (const it of validatedItems) {
                await tx.orderItem.create({
                    data: {
                        orderId:      newOrder.id,
                        productId:    it.productId,
                        variantId:    it.variantId,
                        productName:  it.productName,
                        productImage: it.productImage,
                        variantName:  it.variantName,
                        sku:          it.sku,
                        quantity:     it.quantity,
                        unitPrice:    it.unitPrice,
                        totalPrice:   it.totalPrice,
                        color:        it.color,
                        size:         it.size,
                    },
                });

                if (it.variantId) {
                    await tx.inventory.updateMany({
                        where: { variantId: it.variantId },
                        data:  { quantity: { decrement: it.quantity } },
                    });
                } else {
                    const variants = await tx.productVariant.findMany({
                        where:   { productId: it.productId },
                        include: { inventory: true },
                    });
                    let remaining = it.quantity;
                    for (const v of variants) {
                        if (remaining <= 0 || !v.inventory) continue;
                        const available = v.inventory.quantity - (v.inventory.reservedQty || 0);
                        const deduct = Math.min(remaining, available);
                        if (deduct > 0) {
                            await tx.inventory.updateMany({
                                where: { variantId: v.id },
                                data:  { quantity: { decrement: deduct } },
                            });
                            remaining -= deduct;
                        }
                    }
                    if (remaining > 0) {
                        throw new Error(`Insufficient stock for product ${it.productId}`);
                    }
                }
            }

            return newOrder;
        });

        // ── 5a. UPI via HDFC ─────────────────────────────────────────────────
        if (paymentMethod === 'upi') {
            try {
                const hdfcOrderId = generateHdfcOrderId();
                const user = await prisma.user.findUnique({
                    where:  { id: userId },
                    select: { email: true, phone: true },
                });

                const rawPhone = user.phone || shippingAddress.phone || '';
                const customerPhone = rawPhone.replace(/\D/g, '').slice(-10);

                await createHdfcOrder({
                    hdfcOrderId,
                    amount:         total,
                    customerId:     userId,
                    customerEmail:  user.email,
                    customerPhone,
                    returnUrl: `${process.env.CUSTOMER_FRONTEND_URL}/payment/hdfc/callback?orderId=${order.id}`,
                });

                const txnResponse = await initiateUpiIntent({ hdfcOrderId, customerId: userId });
                logger.info({ txnResponse }, '[HDFC] raw txnResponse from initiateUpiIntent');

                const sdkParams = txnResponse.sdk_params || txnResponse.payment?.sdk_params || {};
                logger.info({ sdkParams }, '[HDFC] extracted sdkParams');

                const upiIntentUri = buildUpiIntentUri(sdkParams);
                logger.info({ upiIntentUri }, '[HDFC] built upiIntentUri');

                await prisma.hdfcPayment.create({
                    data: {
                        orderId:     order.id,
                        hdfcOrderId,
                        txnId:       txnResponse.txn_id   || null,
                        txnUuid:     txnResponse.txn_uuid  || null,
                        status:      txnResponse.status    || 'PENDING',
                        upiIntentUri,
                        sdkParams,
                    },
                });

                return res.status(201).json({
                    success: true,
                    data: {
                        orderId:      order.id,
                        orderNumber:  order.orderNumber,
                        status:       order.status,
                        total:        decimalToNumber(order.total),
                        upiRequired:  true,
                        upiIntentUri,
                        hdfcOrderId,
                    },
                });
            } catch (hdfcErr) {
                logger.error(`HDFC UPI init failed for order ${order.id}: ${hdfcErr.message}`);
                return res.status(201).json({
                    success: true,
                    data: {
                        orderId:      order.id,
                        orderNumber:  order.orderNumber,
                        status:       order.status,
                        total:        decimalToNumber(order.total),
                        upiRequired:  true,
                        upiIntentUri: null,
                        hdfcError:    'Could not connect to payment gateway. Please retry from your orders page.',
                    },
                });
            }
        }

        // ── 5b. Card / Net Banking via HDFC Hypercheckout ───────────────────
        if (['card', 'netbanking'].includes(paymentMethod)) {
            try {
                const hdfcOrderId = generateHdfcOrderId();
                const user = await prisma.user.findUnique({
                    where:  { id: userId },
                    select: { email: true, phone: true },
                });

                const rawPhone = user.phone || shippingAddress.phone || '';
                const customerPhone = rawPhone.replace(/\D/g, '').slice(-10);

                const hdfcOrderData = await createHdfcOrder({
                    hdfcOrderId,
                    amount:        total,
                    customerId:    userId,
                    customerEmail: user.email,
                    customerPhone,
                    returnUrl: `${process.env.API_BASE_URL || 'http://localhost:5009'}/api/v1/payments/hdfc/return`,
                });

                const redirectUrl = hdfcOrderData.payment_links?.web;

                await prisma.hdfcPayment.create({
                    data: {
                        orderId:  order.id,
                        hdfcOrderId,
                        status:   'PENDING',
                        sdkParams: { payment_links: hdfcOrderData.payment_links },
                    },
                });

                logger.info({ hdfcOrderId, redirectUrl }, `[HDFC] ${paymentMethod} Hypercheckout redirect`);

                return res.status(201).json({
                    success: true,
                    data: {
                        orderId:          order.id,
                        orderNumber:      order.orderNumber,
                        status:           order.status,
                        total:            decimalToNumber(order.total),
                        redirectRequired: true,
                        redirectUrl,
                    },
                });
            } catch (hdfcErr) {
                logger.error(`HDFC ${paymentMethod} init failed for order ${order.id}: ${hdfcErr.message}`);
                return res.status(201).json({
                    success: true,
                    data: {
                        orderId:          order.id,
                        orderNumber:      order.orderNumber,
                        status:           order.status,
                        total:            decimalToNumber(order.total),
                        redirectRequired: true,
                        redirectUrl:      null,
                        hdfcError:        'Could not connect to payment gateway. Please retry from your orders page.',
                    },
                });
            }
        }

        // ── 5c. COD — send confirmation email + generate invoice ─────────────
        const orderWithUserAndItems = await prisma.order.findUnique({
            where:   { id: order.id },
            include: {
                user:  { select: { id: true, email: true, firstName: true, lastName: true } },
                items: true,
            },
        });
        if (orderWithUserAndItems) {
            onOrderPlaced(orderWithUserAndItems);
            generateInvoiceAsync(orderWithUserAndItems);
        }

        return res.status(201).json({
            success: true,
            data: {
                orderId:     order.id,
                orderNumber: order.orderNumber,
                status:      order.status,
                total:       decimalToNumber(order.total),
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            const first = error.errors[0];
            const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed';
            return res.status(400).json({ success: false, message: msg, errors: error.errors });
        }
        if (error.code === 'P2002') {
            return res.status(500).json({ success: false, message: 'Order creation failed' });
        }
        next(error);
    }
};
