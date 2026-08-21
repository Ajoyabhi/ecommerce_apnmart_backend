#!/usr/bin/env node
/**
 * Round every product's basePrice to the nearest multiple of 50.
 *
 *   349  -> 350
 *   374  -> 350   (below the midpoint)
 *   375  -> 400   (at/above the midpoint, rounds up)
 *   1020 -> 1050
 *
 * Rounding rule: Math.round(price / 50) * 50
 *
 * Usage (from the app/backend directory):
 *   node scripts/round-product-prices.js            # DRY RUN — shows changes, writes nothing
 *   node scripts/round-product-prices.js --apply    # actually update the database
 *
 * Env: DATABASE_URL (Prisma)
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const STEP = 50;

function roundToStep(value) {
    return Math.round(value / STEP) * STEP;
}

async function main() {
    const products = await prisma.product.findMany({
        select: { id: true, sku: true, name: true, basePrice: true },
        orderBy: { sku: 'asc' },
    });

    console.log(`Found ${products.length} products.`);
    console.log(APPLY ? 'Mode: APPLY (writing changes)\n' : 'Mode: DRY RUN (no changes written)\n');

    const changes = [];

    for (const p of products) {
        // basePrice is a Prisma Decimal — Number() gives the numeric value.
        const current = Number(p.basePrice);
        const rounded = roundToStep(current);
        if (rounded !== current) {
            changes.push({ ...p, current, rounded });
        }
    }

    if (changes.length === 0) {
        console.log('All product prices are already multiples of 50. Nothing to do.');
        return;
    }

    for (const c of changes) {
        console.log(
            `${c.sku.padEnd(20)} ${String(c.current).padStart(10)} -> ${String(c.rounded).padStart(10)}   ${c.name}`
        );
    }

    console.log(`\n${changes.length} product(s) would change.`);

    if (!APPLY) {
        console.log('\nDry run only. Re-run with --apply to write these changes.');
        return;
    }

    // Apply inside a transaction so it is all-or-nothing.
    await prisma.$transaction(
        changes.map((c) =>
            prisma.product.update({
                where: { id: c.id },
                data: { basePrice: c.rounded },
            })
        )
    );

    console.log(`\nUpdated ${changes.length} product price(s). Done.`);
}

main()
    .catch((err) => {
        console.error('Error:', err.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
