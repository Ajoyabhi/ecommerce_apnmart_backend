const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { prisma, redisClient } = require('../../config/database');
const logger = require('../../utils/logger');
const { onOrderPlaced } = require('../../services/orderEmail.service');

exports.createCheckoutSession = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const cartKey = `cart:${userId}`;

        // 1. Get Cart from Redis
        const cartItems = await redisClient.hGetAll(cartKey);
        if (!cartItems || Object.keys(cartItems).length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        // 2. Fetch full product details and validate stock
        const lineItems = [];
        const dbOrderItems = [];
        let subtotal = 0;

        for (const [sku, quantity] of Object.entries(cartItems)) {
            const variant = await prisma.productVariant.findUnique({
                where: { sku },
                include: { product: true, inventory: true }
            });

            if (!variant) continue;
            if (variant.inventory.quantity < parseInt(quantity)) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${variant.product.name}` });
            }

            const unitPrice = parseFloat(variant.product.basePrice) + parseFloat(variant.priceAdjustment);
            const totalItemPrice = unitPrice * parseInt(quantity);
            subtotal += totalItemPrice;

            lineItems.push({
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: variant.product.name,
                        metadata: { sku }
                    },
                    unit_amount: Math.round(unitPrice * 100), // Stripe INR expects paise (1 INR = 100 paise)
                },
                quantity: parseInt(quantity),
            });

            dbOrderItems.push({
                productId: variant.productId,
                variantId: variant.id,
                productName: variant.product.name,
                variantName: variant.name,
                sku: variant.sku,
                quantity: parseInt(quantity),
                unitPrice: unitPrice,
                totalPrice: totalItemPrice
            });
        }

        // 3. Create Order in Pending State
        const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const order = await prisma.order.create({
            data: {
                orderNumber,
                userId,
                status: 'PENDING',
                subtotal,
                total: subtotal, // Assuming no tax/shipping for MVP simplify
                shippingAddress: {}, // To be updated during checkout or from user profile
                items: {
                    create: dbOrderItems
                }
            }
        });

        // 4. Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.CUSTOMER_FRONTEND_URL}/success?orderId=${order.id}`,
            cancel_url: `${process.env.CUSTOMER_FRONTEND_URL}/cart`,
            metadata: {
                orderId: order.id,
                userId
            }
        });

        res.status(200).json({ success: true, url: session.url, sessionId: session.id });
    } catch (error) {
        next(error);
    }
};

exports.handleStripeWebhook = async (req, res, next) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        logger.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata.orderId;

        await prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PROCESSING',
                paymentStatus: 'paid',
                paymentIntentId: session.payment_intent
            }
        });

        const orderWithUserAndItems = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                items: true,
            },
        });
        if (orderWithUserAndItems) {
            onOrderPlaced(orderWithUserAndItems);
        }

        logger.info(`Order ${orderId} successfully paid and moved to processing`);

        const userId = session.metadata.userId;
        await redisClient.del(`cart:${userId}`);
    }

    res.json({ received: true });
};
