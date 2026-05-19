const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { protect } = require('../../middleware/authMiddleware');

// Stripe (legacy)
router.post('/checkout', protect, paymentController.createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

// HDFC SmartGateway (bank-approved files)
router.use('/hdfc', require('./hdfc/hdfc.routes'));

// HDFC — Accuzpay integration (new files, approved files untouched)
router.use('/hdfc', require('./hdfc/accuzpay.routes'));

module.exports = router;
