const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { protect } = require('../../middleware/authMiddleware');

// Stripe (legacy)
router.post('/checkout', protect, paymentController.createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

// HDFC SmartGateway
router.use('/hdfc', require('./hdfc/hdfc.routes'));

module.exports = router;
