const express = require('express');
const router = express.Router();
const hdfcController = require('./hdfc.controller');
const { protect } = require('../../../middleware/authMiddleware');

// UPI Intent — authenticated
router.post('/upi-intent', protect, hdfcController.initiateUpiPayment);

// Payment status polling — authenticated
router.get('/status/:orderId', protect, hdfcController.checkPaymentStatus);

// Webhook — no auth (HDFC posts directly)
router.post('/webhook', hdfcController.handleWebhook);

// Return URL — no auth (browser form-POST from HDFC after card/NB payment)
router.post('/return', hdfcController.handleReturn);

module.exports = router;
