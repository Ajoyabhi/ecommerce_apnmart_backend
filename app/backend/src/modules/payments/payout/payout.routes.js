const express      = require('express');
const router       = express.Router();
const accuzpayAuth = require('../../../middleware/accuzpayAuth');
const { protect }  = require('../../../middleware/authMiddleware');
const ctrl         = require('./payout.controller');

// MizorPay callback — unsigned JSON. Parse defensively regardless of Content-Type;
// the handler reconciles via check-status before trusting it.
// Full URL: <BACKEND_PUBLIC_URL>/api/v1/payments/payout/webhook
router.post('/webhook', express.json({ type: '*/*' }), ctrl.handlePayoutWebhook);

// AccuzPay — secured by the shared API key (x-api-key)
router.post('/initiate', accuzpayAuth, ctrl.initiatePayout);
router.get('/check',     accuzpayAuth, ctrl.checkPayoutTransaction);

// Admin — secured by JWT
router.get('/balance',          protect, ctrl.getPayoutBalance);
router.get('/transactions',     protect, ctrl.listPayoutTransactions);
router.get('/transactions/:id', protect, ctrl.getPayoutTransaction);

module.exports = router;
