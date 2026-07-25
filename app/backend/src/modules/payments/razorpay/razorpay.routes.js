const express      = require('express');
const router       = express.Router();
const accuzpayAuth = require('../../../middleware/accuzpayAuth');
const { protect }  = require('../../../middleware/authMiddleware');
const ctrl         = require('./razorpay.controller');

// Webhook MUST receive raw body for HMAC-SHA256 signature verification
router.post('/rp-webhook', express.raw({ type: 'application/json' }), ctrl.handleRazorpayWebhook);

// AccuzPay — secured by shared API key
router.post('/rp-initiate', accuzpayAuth, ctrl.initiateRazorpayPayin);
router.get('/rp-check',     accuzpayAuth, ctrl.checkRazorpayTransaction);

// Admin — secured by JWT
router.get('/razorpay/transactions',     protect, ctrl.listRazorpayTransactions);
router.get('/razorpay/transactions/:id', protect, ctrl.getRazorpayTransaction);

module.exports = router;
