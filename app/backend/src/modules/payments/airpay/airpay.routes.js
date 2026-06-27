const router       = require('express').Router();
const accuzpayAuth = require('../../../middleware/accuzpayAuth');
const { protect }  = require('../../../middleware/authMiddleware');
const ctrl         = require('./airpay.controller');

// AirPay IPN — AirPay POSTs here on payment completion (no auth, verified server-side)
router.post('/ap-ipn', ctrl.handleAirpayIpn);

// AccuzPay — secured with shared API key
router.post('/ap-initiate', accuzpayAuth, ctrl.initiateAirpayPayin);
router.get('/ap-check',     accuzpayAuth, ctrl.checkAirpayTransaction);

// Admin — secured with JWT
router.get('/transactions',     protect, ctrl.listAirpayTransactions);
router.get('/transactions/:id', protect, ctrl.getAirpayTransaction);

module.exports = router;
