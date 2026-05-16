#!/usr/bin/env node
/**
 * Replace real footwear brand names in product name + brand field
 * with fictional brand names to avoid compliance issues.
 *
 * - Updates `Product.name`  (replaces brand substring in the title)
 * - Updates `Product.brand` (sets the fictional brand)
 *
 * Only touches fashion/footwear products.
 * Safe to re-run — skips products already using fictional brand names.
 *
 * Usage (from app/backend):
 *   node db_create_script/replace-footwear-brands.js
 *
 * Env required: DATABASE_URL
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Real brand → fictional brand mapping
// Each entry has all known spelling/case variants from the CSV
const BRAND_MAP = [
    { real: ['Nike'],                               fictional: 'Strydex' },
    { real: ['Adidas', 'ADIDAS', 'adidas'],         fictional: 'Veltro' },
    { real: ['Puma'],                               fictional: 'Lynxo' },
    { real: ['Reebok'],                             fictional: 'Aerofit' },
    { real: ['FILA', 'Fila', 'Filac'],             fictional: 'Zonix' },
    { real: ['Asics', 'ASICS'],                     fictional: 'Runova' },
    { real: ['New Balance'],                        fictional: 'Equilibra' },
    { real: ['Lotto'],                              fictional: 'Versotto' },
    { real: ['Converse'],                           fictional: 'Canvelo' },
    { real: ['Red Tape', 'Redtape'],                fictional: 'Scarlett Edge' },
    { real: ['Provogue', 'Provouge'],               fictional: 'Elavio' },
    { real: ['Lee Cooper'],                         fictional: 'Coopero' },
    { real: ['Skechers'],                           fictional: 'Komfex' },
    { real: ['Numero Uno'],                         fictional: 'PrimeStep' },
    { real: ['Flying Machine'],                     fictional: 'SwiftGear' },
    { real: ['U.S. Polo Assn.', 'U.S. Polo Assn'], fictional: 'Heritage Club' },
    { real: ['Woodland'],                           fictional: 'Trailko' },
    { real: ['Bata'],                               fictional: 'Steplo' },
];

// Fictional brand names — skip products already replaced
const FICTIONAL_NAMES = new Set(BRAND_MAP.map(b => b.fictional));

async function main() {
    console.log('Fetching footwear products...');

    // Fetch all fashion products (footwear lives under fashion-* slugs)
    const products = await prisma.product.findMany({
        where: {
            category: { slug: { startsWith: 'fashion' } },
            status: 'published',
        },
        select: { id: true, name: true, brand: true, slug: true },
    });

    console.log(`Found ${products.length} fashion products to scan.\n`);

    let updated = 0;
    let skipped = 0;

    for (const product of products) {
        // Skip products already carrying a fictional brand name
        if (product.brand && FICTIONAL_NAMES.has(product.brand)) {
            skipped++;
            continue;
        }

        let newName = product.name;
        let newBrand = product.brand;
        let matched = false;

        for (const { real, fictional } of BRAND_MAP) {
            for (const realName of real) {
                // Case-sensitive check first (matches CSV exactly)
                if (product.name.includes(realName)) {
                    newName = product.name.replace(realName, fictional);
                    newBrand = fictional;
                    matched = true;
                    break;
                }
            }
            if (matched) break;

            // Case-insensitive fallback
            for (const realName of real) {
                const regex = new RegExp(realName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                if (regex.test(product.name)) {
                    newName = product.name.replace(regex, fictional);
                    newBrand = fictional;
                    matched = true;
                    break;
                }
            }
            if (matched) break;
        }

        if (!matched) {
            skipped++;
            continue;
        }

        await prisma.product.update({
            where: { id: product.id },
            data: { name: newName, brand: newBrand },
        });

        updated++;
        if (updated % 100 === 0) {
            console.log(`  Updated ${updated} products...`);
        }
    }

    console.log('\n✅ Done.');
    console.log(`   Products updated : ${updated}`);
    console.log(`   Products skipped : ${skipped}`);

    // Summary of what got replaced
    console.log('\nReplacement summary:');
    for (const { real, fictional } of BRAND_MAP) {
        console.log(`  ${real[0].padEnd(20)} → ${fictional}`);
    }
}

main()
    .catch((err) => {
        console.error('❌ Failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
