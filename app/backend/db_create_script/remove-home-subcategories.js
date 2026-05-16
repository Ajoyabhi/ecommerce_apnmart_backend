#!/usr/bin/env node
/**
 * Remove the 6 leaf sub-subcategories from Home & Living that are no longer needed:
 *   home-kitchen-cookware   (Cookware Sets)
 *   home-kitchen-serveware  (Serveware)
 *   home-decor-wall-art     (Wall Art)
 *   home-decor-lighting     (Lighting)
 *   home-furnishing-bedsheets (Bedsheets)
 *   home-furnishing-cushions  (Cushions & Covers)
 *
 * Any products that live in these leaf categories are moved up to their
 * immediate parent before the category is deleted, so no product is lost.
 *
 * Usage (from app/backend):
 *   node db_create_script/remove-home-subcategories.js
 *
 * Env required: DATABASE_URL
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TO_REMOVE = [
    { slug: 'home-kitchen-cookware',    label: 'Cookware Sets',       parentSlug: 'home-kitchen' },
    { slug: 'home-kitchen-serveware',   label: 'Serveware',           parentSlug: 'home-kitchen' },
    { slug: 'home-decor-wall-art',      label: 'Wall Art',            parentSlug: 'home-decor' },
    { slug: 'home-decor-lighting',      label: 'Lighting',            parentSlug: 'home-decor' },
    { slug: 'home-furnishing-bedsheets',label: 'Bedsheets',           parentSlug: 'home-furnishing' },
    { slug: 'home-furnishing-cushions', label: 'Cushions & Covers',   parentSlug: 'home-furnishing' },
];

async function main() {
    console.log('Removing Home & Living sub-subcategories...\n');

    for (const { slug, label, parentSlug } of TO_REMOVE) {
        const cat = await prisma.category.findFirst({ where: { slug } });
        if (!cat) {
            console.log(`  [skip] "${label}" (${slug}) — not found in DB`);
            continue;
        }

        const parent = await prisma.category.findFirst({ where: { slug: parentSlug } });
        if (!parent) {
            console.warn(`  [warn] Parent "${parentSlug}" not found — skipping "${label}"`);
            continue;
        }

        // Move any products sitting in this leaf up to its parent
        const moved = await prisma.product.updateMany({
            where: { categoryId: cat.id },
            data:  { categoryId: parent.id },
        });
        if (moved.count > 0) {
            console.log(`  Moved ${moved.count} product(s) from "${label}" → "${parentSlug}"`);
        }

        await prisma.category.delete({ where: { id: cat.id } });
        console.log(`  ✓ Deleted category "${label}" (${slug})`);
    }

    console.log('\n✅ Done.');
}

main()
    .catch((err) => {
        console.error('❌ Failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
