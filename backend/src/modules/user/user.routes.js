const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { protect } = require('../../middleware/authMiddleware');

// All routes below require authentication
router.use(protect);

// 1. Dashboard
router.get('/dashboard', userController.getDashboard);

// 2. Profile
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.post('/change-password', userController.changePassword);

// 3. Orders
router.get('/orders', userController.getOrders);
router.post('/orders/request-cod-otp', userController.requestCodOtp);
router.post('/orders/checkout', userController.checkout);
router.get('/orders/:orderId', userController.getOrderById);
router.post('/orders/:orderId/return', userController.requestReturn);

// 4. Addresses
router.get('/addresses', userController.getAddresses);
router.post('/addresses', userController.createAddress);
router.patch('/addresses/:addressId', userController.updateAddress);
router.delete('/addresses/:addressId', userController.deleteAddress);
router.patch('/addresses/:addressId/default', userController.setDefaultAddress);

// 5. Wishlist
router.get('/wishlist', userController.getWishlist);
router.post('/wishlist', userController.addToWishlist);
router.delete('/wishlist/:itemId', userController.removeFromWishlist);

// 6. Saved cards
router.get('/saved-cards', userController.getSavedCards);
router.delete('/saved-cards/:cardId', userController.deleteSavedCard);

// 7. Notifications
router.get('/notifications', userController.getNotifications);
router.patch('/notifications/:notifId/read', userController.markNotificationRead);
router.patch('/notifications/read-all', userController.markAllNotificationsRead);

module.exports = router;

