const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const { protect, authorize } = require('../../middleware/authMiddleware');

// Public Routes
router.get('/', categoryController.getCategories);
router.get('/menu', categoryController.getCategoriesMenu);

// Admin Only Routes
router.post('/', protect, authorize('ADMIN'), categoryController.createCategory);
router.put('/:id', protect, authorize('ADMIN'), categoryController.updateCategory);
router.delete('/:id', protect, authorize('ADMIN'), categoryController.deleteCategory);

module.exports = router;
