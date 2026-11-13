const express      = require('express');
const router       = express.Router();
const accuzpayAuth = require('../../../middleware/accuzpayAuth');
const { protect }  = require('../../../middleware/authMiddleware');
const ctrl         = require('./rapidpay.controller');
const payout       = require('./rapidpay.payout.controller');

// Mounted at /api/v1/payments/rapidpay

// ── RapidPay callbacks (no auth — body is only a trigger, status re-verified) ──
router.post('/rpp-webhook',        express.json({ type: '*/*' }), ctrl.handleRapidpayWebhook);
router.post('/payout/rpp-webhook', express.json({ type: '*/*' }), payout.handleRapidpayPayoutWebhook);

// ── AccuzPay — collection (payin), x-api-key ──
router.post('/rpp-initiate', accuzpayAuth, ctrl.initiateRapidpayPayin);
router.get('/rpp-check',     accuzpayAuth, ctrl.checkRapidpayTransaction);
router.get('/rpp-balance',   accuzpayAuth, ctrl.getRapidpayCollectionBalance);

// ── AccuzPay — disbursement (payout), x-api-key ──
router.post('/payout/rpp-initiate', accuzpayAuth, payout.initiateRapidpayPayout);
router.get('/payout/rpp-check',     accuzpayAuth, payout.checkRapidpayPayout);
router.get('/payout/rpp-balance',   accuzpayAuth, payout.getRapidpayPayoutBalance);

// ── Admin — JWT ──
router.get('/transactions',            protect, ctrl.listRapidpayTransactions);
router.get('/transactions/:id',        protect, ctrl.getRapidpayTransaction);
router.get('/payout/transactions',     protect, payout.listRapidpayPayouts);
router.get('/payout/transactions/:id', protect, payout.getRapidpayPayout);

module.exports = router;
