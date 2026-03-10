const { redisClient, prisma } = require('../../config/database');
const logger = require('../../utils/logger');

exports.addToCart = async (req, res, next) => {
    try {
        const { sku, quantity } = req.body;
        const userId = req.user.id;

        // Optional: Verify SKU exists in PG
        const variant = await prisma.productVariant.findUnique({ where: { sku } });
        if (!variant && process.env.NODE_ENV === 'production') {
            return res.status(404).json({ success: false, message: 'SKU not found' });
        }

        const key = `cart:${userId}`;
        // HINCRBY: Increment the quantity of the item in the cart hash
        await redisClient.hIncrBy(key, sku, parseInt(quantity));

        // Set expiry for cart (e.g., 7 days)
        await redisClient.expire(key, 7 * 24 * 60 * 60);

        res.status(200).json({ success: true, message: 'Item added to cart' });
    } catch (error) {
        next(error);
    }
};

exports.getCart = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const key = `cart:${userId}`;

        const items = await redisClient.hGetAll(key);

        // Format response
        const cartItems = Object.entries(items).map(([sku, quantity]) => ({
            sku,
            quantity: parseInt(quantity)
        }));

        res.status(200).json({ success: true, data: cartItems });
    } catch (error) {
        next(error);
    }
};

exports.removeFromCart = async (req, res, next) => {
    try {
        const { sku } = req.params;
        const userId = req.user.id;
        const key = `cart:${userId}`;

        await redisClient.hDel(key, sku);

        res.status(200).json({ success: true, message: 'Item removed from cart' });
    } catch (error) {
        next(error);
    }
};
