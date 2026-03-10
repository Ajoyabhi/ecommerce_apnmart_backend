const express = require('express');
const router = express.Router();
const contentController = require('./content.controller');

// Public content endpoints
router.get('/hero-banners', contentController.getHeroBanners);
router.get('/category-feed/:categorySlug', contentController.getCategoryFeed);

module.exports = router;

