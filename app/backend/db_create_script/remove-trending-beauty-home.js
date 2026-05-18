#!/usr/bin/env node
/**
 * Remove Beauty and Home & Living products from the trending section.
 * Sets isTrending = false for all products whose category slug starts with
 * "beauty" or "home".
 *
 * Safe to re-run — only touches products that are currently trending.
 *
 * Usage (from app/backend):
 *   node db_create_script/remove-trending-beauty-home.js
 *
 * Env required: DATABASE_URL
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Removing Beauty and Home & Living products from trending...\n');

    const result = await prisma.product.updateMany({
        where: {
            isTrending: true,
            category: {
                OR: [
                    { slug: { startsWith: 'beauty' } },
                    { slug: { startsWith: 'home' } },
                    { slug: 'beauty' },
                    { slug: 'home' },
                ],
            },
        },
        data: { isTrending: false },
    });

    console.log(`✅ Done. ${result.count} product(s) removed from trending.`);
}

main()
    .catch((err) => {
        console.error('❌ Failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
