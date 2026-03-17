const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { protect, authorize } = require('../../middleware/authMiddleware');

// Public Routes
router.get('/', productController.getProducts);
router.get('/:slug', productController.getProductBySlug);

// Admin Only Routes
router.post('/', protect, authorize('ADMIN'), productController.createProduct);
router.put('/:id', protect, authorize('ADMIN'), productController.updateProduct);
router.delete('/:id', protect, authorize('ADMIN'), productController.deleteProduct);

module.exports = router;
