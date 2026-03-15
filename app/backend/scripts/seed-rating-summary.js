#!/usr/bin/env node
/**
 * Seed product rating summaries (distribution + fit/quality opinion) for all products.
 * - If a product has reviews in MongoDB, rating distribution is computed from actual ratings.
 * - Fit opinion and quality opinion are generated as random percentages (sum to 100).
 * - If no reviews, rating distribution is also random (biased toward 4–5 stars).
 *
 * Usage (from backend directory):
 *   node scripts/seed-rating-summary.js
 *
 * Env: DATABASE_URL (Prisma), MONGODB_URI
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const { Review, ProductRatingSummary } = require('../src/models');

const prisma = new PrismaClient();

function randomPercentages(keys) {
  const raw = keys.map(() => Math.random() + 0.1);
  const sum = raw.reduce((a, b) => a + b, 0);
  return Object.fromEntries(keys.map((k, i) => [k, Math.round((raw[i] / sum) * 100)]));
}

function normalizeTo100(obj) {
  const keys = Object.keys(obj);
  const values = keys.map((k) => obj[k] ?? 0);
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return obj;
  const rounded = keys.map((k, i) => Math.round((values[i] / sum) * 100));
  let diff = 100 - rounded.reduce((a, b) => a + b, 0);
  const result = {};
  keys.forEach((k, i) => {
    result[k] = rounded[i] + (diff > 0 ? 1 : diff < 0 ? -1 : 0);
    if (diff !== 0) diff -= diff > 0 ? 1 : -1;
  });
  return result;
}

const FIT_KEYS = ['Perfect', 'Loose', 'Tight', 'Too Loose', 'Too Tight'];
const QUALITY_KEYS = ['Excellent', 'Very Good', 'Average', 'Bad', 'Very Bad'];

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const products = await prisma.product.findMany({
    select: { id: true },
    orderBy: { id: 'asc' }
  });

  console.log('🌱 Seeding rating summaries for', products.length, 'products...');

  let updated = 0;
  for (const product of products) {
    const productId = String(product.id);

    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    const reviewCount = await Review.countDocuments({ product_id: productId, is_approved: true });
    if (reviewCount > 0) {
      const agg = await Review.aggregate([
        { $match: { product_id: productId, is_approved: true } },
        { $group: { _id: '$rating', count: { $sum: 1 } } }
      ]);
      let total = 0;
      agg.forEach((row) => {
        const star = Number(row._id);
        if (star >= 1 && star <= 5) {
          ratingDistribution[star] = row.count;
          total += row.count;
        }
      });
      if (total > 0) {
        for (let i = 1; i <= 5; i++) {
          ratingDistribution[i] = Math.round((ratingDistribution[i] / total) * 100);
        }
        const sum = Object.values(ratingDistribution).reduce((a, b) => a + b, 0);
        if (sum !== 100 && ratingDistribution[5] !== undefined) {
          ratingDistribution[5] += 100 - sum;
        }
      }
    }

    if (reviewCount === 0 || Object.values(ratingDistribution).every((v) => v === 0)) {
      const raw = [1, 2, 3, 4, 5].map((i) => (i >= 4 ? Math.random() * 30 + 15 : Math.random() * 10 + 1));
      const s = raw.reduce((a, b) => a + b, 0);
      for (let i = 1; i <= 5; i++) {
        ratingDistribution[i] = Math.round((raw[i - 1] / s) * 100);
      }
      const sum = Object.values(ratingDistribution).reduce((a, b) => a + b, 0);
      if (sum !== 100) ratingDistribution[5] = (ratingDistribution[5] || 0) + 100 - sum;
    }

    const fitOpinion = normalizeTo100(randomPercentages(FIT_KEYS));
    const qualityOpinion = normalizeTo100(randomPercentages(QUALITY_KEYS));

    await ProductRatingSummary.findOneAndUpdate(
      { product_id: productId },
      {
        product_id: productId,
        rating_distribution: ratingDistribution,
        fit_opinion: fitOpinion,
        quality_opinion: qualityOpinion
      },
      { upsert: true, new: true }
    );
    updated++;
    if (updated % 100 === 0) console.log('   Processed', updated, 'products');
  }

  console.log('✅ Rating summary seeding done. Updated:', updated);
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  });
