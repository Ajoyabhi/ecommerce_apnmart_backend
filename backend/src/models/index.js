const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  pg_id: { type: String, required: true, unique: true, index: true }, // Foreign Key to PostgreSQL
  description_html: { type: String },
  lifestyle_tags: [{ type: String }],
  attributes: {
    material: String,
    dimensions: {
      l: Number,
      w: Number,
      h: Number,
      unit: String
    },
    care_instructions: String
  },
  media_gallery: [{
    url: String,
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    alt: String,
    order: Number,
    is_primary: Boolean
  }],
  seo: {
    meta_title: String,
    meta_description: String,
    structured_data: mongoose.Schema.Types.Mixed
  },
  related_products: [String], // Array of PG UUIDs
  cross_sell: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const heroBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    image: { type: String, required: true },
    mobile_image: { type: String },
    redirect_url: { type: String },
    color: { type: String, default: 'text-white' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    priority: { type: Number, default: 0 },
    validFrom: { type: Date },
    validTo: { type: Date },
  },
  { timestamps: true }
);

const categoryFeedSectionSchema = new mongoose.Schema(
  {
    categorySlug: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['carousel', 'product_grid', 'brand_slider', 'banner', 'product_slider'] },
    title: { type: String, required: true },
    image: { type: String },
    mobile_image: { type: String },
    redirect_url: { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    items: [{
      id: String,
      name: String,
      image: String,
      price: Number,
      slug: String,
      brand_id: String,
      logo: String,
      badge: String,
      subtitle: String,
      link: String,
    }],
  },
  { timestamps: true }
);

const adminLogSchema = new mongoose.Schema({
  admin_id: { type: String, required: true, index: true },
  action: { type: String, required: true },
  entity_type: String,
  entity_id: String,
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  ip_address: String,
  user_agent: String,
  timestamp: { type: Date, default: Date.now }
});

const activityLogSchema = new mongoose.Schema({
  user_id: String,
  session_id: String,
  event_type: String,
  metadata: mongoose.Schema.Types.Mixed,
  device: {
    type: String,
    os: String,
    browser: String
  },
  geo: {
    country: String,
    city: String
  },
  timestamp: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  pg_id: { type: String, unique: true }, // Link to PG review entry if exists
  product_id: { type: String, required: true, index: true },
  user: {
    id: String,
    name: String,
    avatar: String,
    verified_purchaser: Boolean
  },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: String,
  content: String,
  images: [{ url: String, caption: String }],
  attribute_ratings: {
    quality: Number,
    value: Number,
    shipping: Number
  },
  likes: { type: Number, default: 0 },
  replies: [{
    user_id: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  is_approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  ProductRichContent: mongoose.model('ProductRichContent', productSchema, 'products'),
  HeroBanner: mongoose.model('HeroBanner', heroBannerSchema, 'hero_banners'),
  CategoryFeedSection: mongoose.model('CategoryFeedSection', categoryFeedSectionSchema, 'category_feed_sections'),
  AdminLog: mongoose.model('AdminLog', adminLogSchema),
  ActivityLog: mongoose.model('ActivityLog', activityLogSchema),
  Review: mongoose.model('Review', reviewSchema)
};
