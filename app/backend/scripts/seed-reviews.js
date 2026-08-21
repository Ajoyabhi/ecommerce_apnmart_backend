#!/usr/bin/env node
/**
 * Seed dummy reviews + rating summaries (MongoDB) for ALL existing products.
 *
 * Products live in Postgres (Prisma); reviews & rating summaries live in Mongo.
 * This mirrors the seedReviews()/seedRatingSummaries() logic in seed.js, but as a
 * standalone runner so you can (re)generate review data WITHOUT re-running the
 * full product seeders.
 *
 * Usage (from the app/backend directory):
 *   node scripts/seed-reviews.js              # add reviews only for products that have NONE (safe)
 *   node scripts/seed-reviews.js --force      # wipe existing seeded reviews first, then reseed everyone
 *
 * Env: DATABASE_URL (Prisma) and MONGODB_URI (Mongo)
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const { Review, ProductRatingSummary } = require('../src/models');

const prisma = new PrismaClient();
const FORCE = process.argv.includes('--force');

// ── Dummy content pools (kept in sync with seed.js) ──────────────────────────
const REVIEW_SEED_USERS = [
    { name: 'Amit Verma', avatar: 'https://i.pravatar.cc/150?img=3' },
    { name: 'Sneha Kapoor', avatar: 'https://i.pravatar.cc/150?img=5' },
    { name: 'Rahul Sharma', avatar: 'https://i.pravatar.cc/150?img=7' },
    { name: 'Neha Singh', avatar: 'https://i.pravatar.cc/150?img=8' },
    { name: 'Arjun Mehta', avatar: 'https://i.pravatar.cc/150?img=10' },
    { name: 'Priya Nair', avatar: 'https://i.pravatar.cc/150?img=12' },
    { name: 'Karan Patel', avatar: 'https://i.pravatar.cc/150?img=14' },
    { name: 'Riya Das', avatar: 'https://i.pravatar.cc/150?img=16' },
    { name: 'Vikram Reddy', avatar: 'https://i.pravatar.cc/150?img=18' },
    { name: 'Ananya Iyer', avatar: 'https://i.pravatar.cc/150?img=20' },
    { name: 'Rohan Gupta', avatar: 'https://i.pravatar.cc/150?img=22' },
    { name: 'Kavya Menon', avatar: 'https://i.pravatar.cc/150?img=24' }
];

const REVIEW_SEED_TITLES = [
    'Great quality at this price', 'Value for money purchase', 'Exactly as shown in pictures',
    'Comfortable and stylish', 'Good, but room for improvement', 'Highly recommended',
    'Impressed with the fit', 'Would buy again', 'Solid purchase', 'No regrets',
    'Better than expected', 'Quick delivery and good packaging', 'Happy with it',
    'Worth every rupee', 'Nice product', 'Decent for the price', 'Exactly what I wanted',
    'Good fit and finish', 'Satisfied customer', 'Will recommend to friends',
    'Pretty good overall', 'Nice colour and material', 'Fast shipping',
    'As described', 'Pleased with the quality', 'Could be better', 'Not bad',
    'Mixed feelings', 'Great for daily use', 'Stylish and comfortable', 'Love it'
];

const REVIEW_SEED_BODIES = [
    'The product quality is better than I expected. The material feels premium and the finish is neat. Shipping was quick and the packaging was secure.',
    'Looks exactly like the images on the site. Size was accurate and the color is rich. Have already recommended it to a friend.',
    'Very comfortable to use on a daily basis. After a few weeks of use there are no issues so far. Definitely worth the price.',
    'Good overall experience. There were minor stitching issues but nothing major. If you are on the fence, go for it.',
    'The fit is perfect and the design feels modern. Works well with multiple outfits and I have already received compliments.',
    'Satisfied with the purchase. Delivery was on time and customer support was responsive. I might pick another variant soon.',
    'Build quality is solid and it feels durable. The details are well done and it looks even better in person.',
    'Product matches the description and feels thoughtfully designed. Would happily purchase from this brand again.',
    'Came well packed. Quality is good for the price. Wearing it regularly with no issues.',
    'First time buying from here. Impressed. The fabric is soft and the sizing was correct.',
    'Ordered two sizes to be safe; kept the larger one. Both looked great. No complaints.',
    'Delivery took a bit longer than expected but the product itself is fine. Would order again.',
    'Nice and lightweight. Perfect for the season. Colour is true to the image.',
    'Good stitching and finish. Feels like it will last. Happy with my choice.',
    'Exactly as shown. No surprises. Packaging could be better but product is good.',
    'Comfortable and true to size. Already planning to order in another colour.',
    'Solid build and good value. Minor flaw on one edge but not noticeable when in use.',
    'Very pleased. Looks expensive and fits well. Will recommend.',
    'Quick delivery. Product is as described. Using it daily and no wear so far.',
    'Good buy. Nothing to complain about. Might try other items from the brand.',
    'Nice product. A bit pricey but quality justifies it. Fits perfectly.',
    'Received in good condition. Wore it once already. Comfortable and stylish.',
    'Happy with the purchase. Exactly what I needed. No issues.',
    'Good quality and fast shipping. Would buy again. Sizing was accurate.',
    'Pleased overall. Small defect on packaging but product is intact and looks good.',
    'Worth the money. Comfortable and durable. Already got a second one.',
    'Nice fit and finish. Delivery was smooth. Recommended.',
    'As advertised. No complaints. Using it regularly.',
    'Good experience. Product met expectations. Will consider repurchasing.',
    'Satisfied. Quality is decent and delivery was on time.',
    'Works as expected. Comfortable. Would recommend to others.'
];

const RATING_SUMMARY_FIT_KEYS = ['Perfect', 'Loose', 'Tight', 'Too Loose', 'Too Tight'];
const RATING_SUMMARY_QUALITY_KEYS = ['Excellent', 'Very Good', 'Average', 'Bad', 'Very Bad'];

// ── Helpers ──────────────────────────────────────────────────────────────────
const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Weighted so most ratings are 4–5 stars (realistic-looking).
function randRating() {
    const weights = [1, 2, 3, 4, 5].map((r) => (r >= 4 ? 3 : r === 3 ? 2 : 1));
    const total = weights.reduce((s, w) => s + w, 0);
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

// ── Seeders ──────────────────────────────────────────────────────────────────
async function seedReviews(productIds) {
    console.log(`🌱 Seeding reviews for ${productIds.length} products (1–100 each)...`);
    let created = 0;
    let skipped = 0;

    for (const productId of productIds) {
        if (!FORCE) {
            const existing = await Review.countDocuments({ product_id: productId });
            if (existing > 0) { skipped++; continue; }
        }

        const count = randInt(1, 100);
        const docs = [];
        for (let i = 0; i < count; i++) {
            const userMeta = randItem(REVIEW_SEED_USERS);
            const rating = randRating();
            docs.push({
                pg_id: `${productId}-seed-${i}`,
                product_id: productId,
                user: {
                    id: null,
                    name: userMeta.name,
                    avatar: userMeta.avatar,
                    verified_purchaser: Math.random() < 0.7
                },
                rating,
                title: randItem(REVIEW_SEED_TITLES),
                content: randItem(REVIEW_SEED_BODIES),
                images: [],
                attribute_ratings: buildAttributeRatings(rating),
                likes: randInt(0, 50),
                replies: [],
                is_approved: true,
                createdAt: new Date(Date.now() - randInt(1, 90) * 24 * 60 * 60 * 1000)
            });
        }
        await Review.insertMany(docs);
        created += docs.length;
    }

    console.log(`✅ Reviews done. Created: ${created} | Products skipped (already had reviews): ${skipped}`);
}

async function seedRatingSummaries(productIds) {
    console.log(`🌱 Seeding rating summaries for ${productIds.length} products...`);
    let updated = 0;

    for (const productId of productIds) {
        let dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const reviewCount = await Review.countDocuments({ product_id: productId, is_approved: true });

        if (reviewCount > 0) {
            const agg = await Review.aggregate([
                { $match: { product_id: productId, is_approved: true } },
                { $group: { _id: '$rating', count: { $sum: 1 } } }
            ]);
            let total = 0;
            agg.forEach((row) => {
                const star = Number(row._id);
                if (star >= 1 && star <= 5) { dist[star] = row.count; total += row.count; }
            });
            if (total > 0) {
                for (let i = 1; i <= 5; i++) dist[i] = Math.round((dist[i] / total) * 100);
                const sum = Object.values(dist).reduce((a, b) => a + b, 0);
                if (sum !== 100) dist[5] += 100 - sum;
            }
        }
        if (reviewCount === 0 || Object.values(dist).every((v) => v === 0)) {
            const raw = [1, 2, 3, 4, 5].map((i) => (i >= 4 ? Math.random() * 30 + 15 : Math.random() * 10 + 1));
            const s = raw.reduce((a, b) => a + b, 0);
            for (let i = 1; i <= 5; i++) dist[i] = Math.round((raw[i - 1] / s) * 100);
            const sum = Object.values(dist).reduce((a, b) => a + b, 0);
            if (sum !== 100) dist[5] = (dist[5] || 0) + 100 - sum;
        }

        await ProductRatingSummary.findOneAndUpdate(
            { product_id: productId },
            {
                product_id: productId,
                rating_distribution: dist,
                fit_opinion: normalizeTo100(randomPercentages(RATING_SUMMARY_FIT_KEYS)),
                quality_opinion: normalizeTo100(randomPercentages(RATING_SUMMARY_QUALITY_KEYS))
            },
            { upsert: true, new: true }
        );
        updated++;
        if (updated % 100 === 0) console.log(`   Rating summaries: ${updated}...`);
    }

    console.log(`✅ Rating summaries done. Updated: ${updated}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set — cannot seed reviews (they live in MongoDB).');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const products = await prisma.product.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
    const productIds = products.map((p) => String(p.id));
    console.log(`Found ${productIds.length} products. Mode: ${FORCE ? 'FORCE (wipe + reseed)' : 'safe (skip products that already have reviews)'}\n`);

    if (FORCE) {
        console.log('⚠  --force: deleting all seeded reviews (pg_id ending in "-seed-N") first...');
        await Review.deleteMany({ pg_id: /-seed-\d+$/ });
    }

    await seedReviews(productIds);
    await seedRatingSummaries(productIds);

    console.log('\nAll done.');
}

main()
    .catch((err) => {
        console.error('Error:', err.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await mongoose.disconnect();
    });
