#!/usr/bin/env node
/**
 * Update existing product basePrice to 100–2000 INR (multiples of 100).
 * Applies to fashion and home categories; electronics are left unchanged.
 *
 * Usage (from backend directory):
 *   node scripts/update-product-prices.js
 *
 * Env: DATABASE_URL (Prisma)
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function randomPrice100to2000() {
    return 100 * (1 + Math.floor(Math.random() * 20));
}

async function main() {
    const products = await prisma.product.findMany({
        select: {
            id: true,
            basePrice: true,
            slug: true,
            categoryId: true,
            category: { select: { slug: true } },
        },
        orderBy: { id: 'asc' },
    });

    let updated = 0;
    let skipped = 0;

    for (const p of products) {
        const slug = (p.category?.slug || '').toLowerCase();
        const isFashion = slug.startsWith('fashion');
        const isHome = slug.startsWith('home');
        const isBeauty = slug.startsWith('beauty');
        const isElectronics = slug.startsWith('electronics');

        if (isElectronics) {
            skipped++;
            continue;
        }

        const newPrice = randomPrice100to2000();
        await prisma.product.update({
            where: { id: p.id },
            data: { basePrice: newPrice },
        });
        updated++;
        if (updated % 100 === 0) {
            console.log(`   Updated ${updated} product prices...`);
        }
    }

    console.log('✅ Price update done.');
    console.log('   Updated:', updated);
    console.log('   Skipped (electronics):', skipped);
}

main()
    .catch((err) => {
        console.error('❌ Failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
