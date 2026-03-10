const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { protect } = require('../../middleware/authMiddleware');

// Route for creating Stripe checkout session
router.post('/checkout', protect, paymentController.createCheckoutSession);

// Stripe Webhook (Handle as public but with signature verification)
// NOTE: This usually requires express.raw() or special handling for the signature
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

module.exports = router;
