const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const hdfcController = require('./hdfc.controller');
const { protect } = require('../../middleware/authMiddleware');

// Stripe
router.post('/checkout', protect, paymentController.createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

// HDFC UPI Intent
router.post('/hdfc/upi-intent', protect, hdfcController.initiateUpiPayment);
router.post('/hdfc/webhook', hdfcController.handleWebhook);
router.get('/hdfc/status/:orderId', protect, hdfcController.checkPaymentStatus);

// HDFC return URL — browser form-POST from HDFC's domain after card/NB payment.
router.post('/hdfc/return', hdfcController.handleReturn);

module.exports = router;
