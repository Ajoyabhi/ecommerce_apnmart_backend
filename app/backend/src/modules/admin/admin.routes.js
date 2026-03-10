const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { protect, authorize } = require('../../middleware/authMiddleware');

router.use(protect, authorize('ADMIN'));

// Admin Orders (ADMIN_ORDERS_API.md)
router.get('/orders', adminController.listOrders);
router.get('/orders/:orderId', adminController.getOrderById);
router.patch('/orders/:orderId/status', adminController.updateOrderStatus);
router.patch('/orders/:orderId/payment-status', adminController.updateOrderPaymentStatus);
router.post('/orders/:orderId/cancel', adminController.cancelOrder);
router.post('/orders/:orderId/notes', adminController.addOrderNote);

router.get('/inventory', adminController.getInventory);
router.patch('/inventory/:variantId', adminController.updateStock);
router.get('/dashboard/stats', adminController.getDashboardStats);

// Hero banners (homepage hero slides) management
router.get('/hero-banners', adminController.getHeroBannersAdmin);
router.post('/hero-banners', adminController.createHeroBanner);
router.patch('/hero-banners/:id', adminController.updateHeroBanner);
router.delete('/hero-banners/:id', adminController.deleteHeroBanner);

// Category feed sections (e.g. Men / Women landing page sections)
router.get('/category-feed-sections', adminController.getCategoryFeedSectionsAdmin);
router.post('/category-feed-sections', adminController.createCategoryFeedSection);
router.patch('/category-feed-sections/:id', adminController.updateCategoryFeedSection);
router.delete('/category-feed-sections/:id', adminController.deleteCategoryFeedSection);

module.exports = router;
