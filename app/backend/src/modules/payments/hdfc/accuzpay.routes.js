const router  = require('express').Router();
const auth    = require('../../../middleware/accuzpayAuth');
const ctrl    = require('./accuzpay.controller');

// Payment initiation — secured with shared API key
router.post('/pg-initiate', auth, ctrl.initiateAccuzpayPayin);

// HDFC payment notification (return_url POST) — no auth, HDFC posts directly
router.post('/pg-notify', ctrl.handlePgNotify);

// Transaction management — secured with shared API key
router.get('/accuzpay/transactions',              auth, ctrl.listAccuzpayTransactions);
router.get('/accuzpay/transactions/:id',          auth, ctrl.getAccuzpayTransaction);
router.get('/accuzpay/products',                  auth, ctrl.searchProducts);
router.post('/accuzpay/transactions/:id/items',   auth, ctrl.saveTransactionItems);
router.get('/accuzpay/transactions/:id/invoice',  auth, ctrl.downloadInvoice);

module.exports = router;
