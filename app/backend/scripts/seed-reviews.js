#!/usr/bin/env node
/**
 * Seed dummy product reviews into MongoDB for all products in PostgreSQL.
 *
 * - For each product in the `product` table, creates a handful of realistic‑looking
 *   reviews in the `reviews` collection.
 * - Skips products that already have at least one review (idempotent-ish).
 *
 * Usage (from backend directory):
 *   node scripts/seed-reviews.js
 *
 * Env:
 *   DATABASE_URL  (PostgreSQL via Prisma)
 *   MONGODB_URI   (MongoDB for Review documents)
 *
 * Optional:
 *   REVIEW_SEED_BATCH           (default 500)  - number of products fetched per batch
 *   REVIEWS_PER_PRODUCT_MIN     (default 1)
 *   REVIEWS_PER_PRODUCT_MAX     (default 4)
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const { Review } = require('../src/models');

const prisma = new PrismaClient();

const SAMPLE_USERS = [
  { name: 'Amit Verma', avatar: 'https://i.pravatar.cc/150?img=3' },
  { name: 'Sneha Kapoor', avatar: 'https://i.pravatar.cc/150?img=5' },
  { name: 'Rahul Sharma', avatar: 'https://i.pravatar.cc/150?img=7' },
  { name: 'Neha Singh', avatar: 'https://i.pravatar.cc/150?img=8' },
  { name: 'Arjun Mehta', avatar: 'https://i.pravatar.cc/150?img=10' },
  { name: 'Priya Nair', avatar: 'https://i.pravatar.cc/150?img=12' },
  { name: 'Karan Patel', avatar: 'https://i.pravatar.cc/150?img=14' },
  { name: 'Riya Das', avatar: 'https://i.pravatar.cc/150?img=16' }
];

const SAMPLE_TITLES = [
  'Great quality at this price',
  'Value for money purchase',
  'Exactly as shown in pictures',
  'Comfortable and stylish',
  'Good, but room for improvement',
  'Highly recommended',
  'Impressed with the fit',
  'Would buy again'
];

const SAMPLE_BODIES = [
  'The product quality is better than I expected. The material feels premium and the finish is neat. Shipping was quick and the packaging was secure.',
  'Looks exactly like the images on the site. Size was accurate and the color is rich. Have already recommended it to a friend.',
  'Very comfortable to use on a daily basis. After a few weeks of use there are no issues so far. Definitely worth the price.',
  'Good overall experience. There were minor stitching issues but nothing major. If you are on the fence, go for it.',
  'The fit is perfect and the design feels modern. Works well with multiple outfits and I have already received compliments.',
  'Satisfied with the purchase. Delivery was on time and customer support was responsive. I might pick another variant soon.',
  'Build quality is solid and it feels durable. The details are well done and it looks even better in person.',
  'Product matches the description and feels thoughtfully designed. Would happily purchase from this brand again.'
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRating() {
  // Bias towards positive reviews
  const weights = [1, 2, 3, 4, 5].map((r) => (r >= 4 ? 3 : r === 3 ? 2 : 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return i + 1;
  }
  return 4;
}

function buildAttributeRatings(overall) {
  const jitter = () => (Math.random() < 0.5 ? 0 : 1);
  const clamp = (v) => Math.max(1, Math.min(5, v));
  return {
    quality: clamp(overall + jitter()),
    value: clamp(overall),
    shipping: clamp(overall - (Math.random() < 0.2 ? 1 : 0))
  };
}

async function main() {
  const batchSize = parseInt(process.env.REVIEW_SEED_BATCH || '500', 10);
  const minPerProduct = parseInt(process.env.REVIEWS_PER_PRODUCT_MIN || '1', 10);
  const maxPerProduct = parseInt(process.env.REVIEWS_PER_PRODUCT_MAX || '4', 10);

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to seed reviews.');
  }

  console.log('🌱 Seeding dummy reviews...');
  console.log('Batch size:', batchSize);
  console.log('Reviews per product:', `${minPerProduct}-${maxPerProduct}`);

  await mongoose.connect(process.env.MONGODB_URI);

  let skip = 0;
  let totalProductsScanned = 0;
  let totalReviewsCreated = 0;

  // Paginate through all products so we do not load entire table into memory.
  // Uses skip/take which is fine for one-off scripts.
  for (;;) {
    const products = await prisma.product.findMany({
      skip,
      take: batchSize,
      orderBy: { id: 'asc' },
      select: { id: true, name: true, brand: true }
    });

    if (!products.length) break;

    console.log(`Processing products ${skip + 1}–${skip + products.length}...`);
    skip += products.length;
    totalProductsScanned += products.length;

    for (const product of products) {
      const productId = String(product.id);

      // Skip products that already have at least one review to avoid uncontrolled duplication
      const existingCount = await Review.countDocuments({ product_id: productId });
      if (existingCount > 0) continue;

      const reviewCount = randomInt(minPerProduct, maxPerProduct);
      const docs = [];

      for (let i = 0; i < reviewCount; i++) {
        const userMeta = randomItem(SAMPLE_USERS);
        const rating = randomRating();
        const createdAt = new Date(
          Date.now() - randomInt(1, 60) * 24 * 60 * 60 * 1000
        ); // within last ~2 months

        docs.push({
          pg_id: `${productId}-seed-${i}`, // synthetic unique id so unique index is satisfied
          product_id: productId,
          user: {
            id: null,
            name: userMeta.name,
            avatar: userMeta.avatar,
            verified_purchaser: Math.random() < 0.7
          },
          rating,
          title: randomItem(SAMPLE_TITLES),
          content: randomItem(SAMPLE_BODIES),
          images: [],
          attribute_ratings: buildAttributeRatings(rating),
          likes: randomInt(0, 25),
          replies: [],
          is_approved: true,
          createdAt
        });
      }

      if (docs.length) {
        await Review.insertMany(docs);
        totalReviewsCreated += docs.length;
      }
    }
  }

  console.log('✅ Dummy review seeding finished.');
  console.log('Products scanned:', totalProductsScanned);
  console.log('Reviews created:', totalReviewsCreated);
}

main()
  .catch((err) => {
    console.error('❌ Failed to seed reviews:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  });

