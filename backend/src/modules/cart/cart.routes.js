const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect); // All cart routes require auth

router.get('/', cartController.getCart);
router.post('/items', cartController.addToCart);
router.delete('/items/:sku', cartController.removeFromCart);

module.exports = router;
