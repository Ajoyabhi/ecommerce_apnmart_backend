const router      = require('express').Router();
const accuzpayAuth = require('../../../middleware/accuzpayAuth');
const { protect }  = require('../../../middleware/authMiddleware');
const ctrl         = require('./accuzpay.controller');

// Payment initiation — called by accuzpay backend, secured with shared API key
router.post('/pg-initiate', accuzpayAuth, ctrl.initiateAccuzpayPayin);

// HDFC payment notification (return_url POST) — no auth, HDFC posts directly
router.post('/pg-notify', ctrl.handlePgNotify);

// Transaction management — called by ecommerce admin UI, secured with admin JWT
router.get('/accuzpay/transactions',              protect, ctrl.listAccuzpayTransactions);
router.get('/accuzpay/transactions/:id',          protect, ctrl.getAccuzpayTransaction);
router.get('/accuzpay/products',                  protect, ctrl.searchProducts);
router.post('/accuzpay/transactions/:id/items',   protect, ctrl.saveTransactionItems);
router.get('/accuzpay/transactions/:id/invoice',  protect, ctrl.downloadInvoice);

module.exports = router;
