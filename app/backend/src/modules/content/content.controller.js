const { HeroBanner, CategoryFeedSection } = require('../../models');

exports.getHeroBanners = async (req, res, next) => {
  try {
    const now = new Date();
    const banners = await HeroBanner.find({
      isActive: true,
      $or: [
        { validFrom: { $exists: false }, validTo: { $exists: false } },
        { validFrom: { $lte: now }, validTo: { $gte: now } },
        { validFrom: null, validTo: null },
      ],
    })
      .sort({ priority: -1, sortOrder: 1, createdAt: -1 })
      .lean();

    const normalized = banners.map((b) => ({
      id: b._id.toString(),
      title: b.title,
      subtitle: b.subtitle,
      image: b.image,
      mobile_image: b.mobile_image,
      redirect_url: b.redirect_url,
      color: b.color || 'text-white',
      priority: b.priority ?? 0,
    }));

    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).json({
      success: true,
      count: normalized.length,
      data: normalized,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/content/category-feed/:categorySlug
 * Returns dynamic sections for a category landing page (e.g. Men, Women).
 */
exports.getCategoryFeed = async (req, res, next) => {
  try {
    const { categorySlug } = req.params;
    const sections = await CategoryFeedSection.find({
      categorySlug: categorySlug.toLowerCase(),
      isActive: true,
    })
      .sort({ displayOrder: 1 })
      .lean();

    const normalized = sections.map((s) => ({
      type: s.type,
      title: s.title,
      image: s.image,
      mobile_image: s.mobile_image,
      redirect_url: s.redirect_url,
      displayOrder: s.displayOrder,
      items: s.items || [],
    }));

    res.set('Cache-Control', 'public, max-age=120');
    res.status(200).json({
      success: true,
      category: categorySlug,
      sections: normalized,
    });
  } catch (error) {
    next(error);
  }
};

