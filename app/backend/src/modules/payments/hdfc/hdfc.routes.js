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

// ── Webhook reachability probe ── remove after confirming webhooks work ──────
// Test with: curl -X POST https://api.anpamart.com/api/v1/payments/hdfc/webhook-ping
router.post('/webhook-ping', (req, res) => {
    const logger = require('../../../utils/logger');
    logger.info({ ip: req.ip, body: req.body, headers: req.headers }, '[HDFC] webhook-ping hit');
    res.status(200).json({ received: true, ts: new Date().toISOString(), ip: req.ip });
});

// Return URL — no auth (browser form-POST from HDFC after card/NB payment)
router.post('/return', hdfcController.handleReturn);

module.exports = router;
