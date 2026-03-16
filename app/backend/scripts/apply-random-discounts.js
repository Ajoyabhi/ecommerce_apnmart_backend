#!/usr/bin/env node
/**
 * Apply a random discount (5–50%) to all existing products by reducing
 * their current `basePrice` in the database.
 *
 * This script:
 * - Reads all products from Prisma `Product`
 * - For each product, picks a random integer discount between 5 and 50
 * - Computes: newBasePrice = basePrice * (1 - discount / 100)
 * - Updates the product's `basePrice` to the discounted value
 *
 * Usage (from backend directory):
 *   node scripts/apply-random-discounts.js
 *
 * Env:
 *   - DATABASE_URL (Prisma/Postgres)
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function randomDiscountPercent() {
    // Integer in [5, 50]
    return 5 + Math.floor(Math.random() * 46);
}

function applyDiscount(basePriceDecimal, discountPercent) {
    const base = Number(basePriceDecimal);
    if (!Number.isFinite(base)) {
        throw new Error(`Invalid basePrice: ${basePriceDecimal}`);
    }

    const factor = 1 - discountPercent / 100;
    const discounted = base * factor;

    // First round to 2 decimals
    let price = Math.round(discounted * 100) / 100;

    // Enforce a minimum price of 100
    if (price < 100) {
        price = 100;
    }

    // To avoid looking too "fabricated", only some products follow the 99-pattern.
    // ~60% of products will be snapped to an xx99 price.
    if (Math.random() < 0.6) {
        const hundreds = Math.floor(price / 100);
        const snapped = hundreds * 100 + 99;
        // Ensure we still respect the 100 minimum
        price = Math.max(100, snapped);
    } else {
        // Remaining ~40%: mix of regular rounded prices and clean multiples of 100
        const r = Math.random();
        if (r < 0.5) {
            // Keep as-is (just the rounded price)
            // no-op
        } else {
            // Snap to nearest 100 (e.g. 523 -> 500, 581 -> 600)
            const hundreds = Math.round(price / 100);
            price = Math.max(100, hundreds * 100);
        }
    }

    return price;
}

async function main() {
    console.log('📦 Fetching products to apply random discounts (5–50%)...');

    const products = await prisma.product.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            status: true,
        },
        orderBy: { id: 'asc' },
    });

    console.log(`   Found ${products.length} products.`);

    let updated = 0;

    for (const p of products) {
        // Only discount active storefront products by default
        if (p.status !== 'published') {
            continue;
        }

        const discountPercent = randomDiscountPercent();
        const newBasePrice = applyDiscount(p.basePrice, discountPercent);

        await prisma.product.update({
            where: { id: p.id },
            data: {
                basePrice: newBasePrice,
                discountPct: discountPercent,
            },
        });

        updated++;

        if (updated % 100 === 0) {
            console.log(
                `   Updated ${updated} products... (last: ${p.slug} -> ${newBasePrice} with ${discountPercent}% off)`
            );
        }
    }

    console.log('✅ Random discount application complete.');
    console.log('   Products updated:', updated);
}

main()
    .catch((err) => {
        console.error('❌ Failed to apply discounts:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

