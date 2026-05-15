#!/usr/bin/env node
/**
 * Two fixes in one script — safe to run on the live server at any time:
 *
 * 1. TRENDING — Mark exactly 100 published products as isTrending=true,
 *    spread evenly across all leaf categories (categories that have no
 *    children). Previous isTrending flags are cleared first so you always
 *    end up with a clean set of exactly 100.
 *
 * 2. BEAUTY SUBCATEGORY FIX — Some beauty subcategories have zero products
 *    because the JSON product_type values didn't match a leaf slug. This fix
 *    redistributes existing beauty products so every beauty subcategory gets
 *    at least MIN_PER_BEAUTY_CAT products.
 *
 * Usage (from app/backend):
 *   node db_create_script/fix-trending-and-beauty.js
 *
 * Optional env overrides:
 *   TRENDING_COUNT=100          How many products to mark as trending (default 100)
 *   MIN_PER_BEAUTY_CAT=5        Min products each beauty subcategory should have (default 5)
 *
 * Env required:
 *   DATABASE_URL                PostgreSQL (Prisma)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TRENDING_COUNT = parseInt(process.env.TRENDING_COUNT || '100', 10);
const MIN_PER_BEAUTY_CAT = parseInt(process.env.MIN_PER_BEAUTY_CAT || '5', 10);

// ─── helpers ────────────────────────────────────────────────────────────────

/** Shuffle an array in-place (Fisher-Yates). */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ─── FIX 1: Trending ────────────────────────────────────────────────────────

async function fixTrending() {
    console.log('\n━━━ FIX 1: Trending products ━━━');

    // Clear all existing trending flags
    const cleared = await prisma.product.updateMany({
        where: { isTrending: true },
        data: { isTrending: false },
    });
    console.log(`Cleared isTrending on ${cleared.count} existing products.`);

    // Find every leaf category (a category that has no child categories)
    const allCategories = await prisma.category.findMany({
        select: { id: true, slug: true, name: true, parentId: true },
    });

    const parentIds = new Set(
        allCategories.filter(c => c.parentId !== null).map(c => c.parentId)
    );
    const leafCategories = allCategories.filter(c => !parentIds.has(c.id) && c.isActive !== false);

    console.log(`Found ${leafCategories.length} leaf categories.`);

    // For each leaf category, fetch its published product IDs (shuffled so we
    // don't always pick the same products on repeated runs)
    const byCategory = [];
    for (const cat of leafCategories) {
        const products = await prisma.product.findMany({
            where: { categoryId: cat.id, status: 'published' },
            select: { id: true },
            orderBy: { id: 'asc' },
        });
        if (products.length > 0) {
            byCategory.push({ cat, ids: shuffle(products.map(p => p.id)) });
        }
    }

    if (byCategory.length === 0) {
        console.log('No published products found in any category. Skipping trending step.');
        return;
    }

    // Round-robin across categories until we have TRENDING_COUNT IDs
    const picked = new Set();
    let round = 0;
    while (picked.size < TRENDING_COUNT) {
        let addedThisRound = 0;
        for (const entry of byCategory) {
            if (picked.size >= TRENDING_COUNT) break;
            if (round < entry.ids.length) {
                picked.add(entry.ids[round]);
                addedThisRound++;
            }
        }
        round++;
        // Stop if we've exhausted all available products
        if (addedThisRound === 0) break;
    }

    const pickedIds = Array.from(picked);
    await prisma.product.updateMany({
        where: { id: { in: pickedIds } },
        data: { isTrending: true },
    });

    console.log(`Marked ${pickedIds.length} products as isTrending=true.`);
    console.log(`Categories represented: ${byCategory.filter(e => e.ids.some(id => picked.has(id))).length} of ${byCategory.length}`);

    // Print per-category breakdown
    for (const entry of byCategory) {
        const count = entry.ids.filter(id => picked.has(id)).length;
        if (count > 0) {
            console.log(`  ${entry.cat.slug}: ${count} trending`);
        }
    }
}

// ─── FIX 2: Beauty subcategory redistribution ───────────────────────────────

async function fixBeautySubcategories() {
    console.log('\n━━━ FIX 2: Beauty subcategory redistribution ━━━');

    // Find the beauty root
    const beautyRoot = await prisma.category.findFirst({
        where: { slug: 'beauty' },
        select: { id: true },
    });
    if (!beautyRoot) {
        console.log('No beauty root category found. Skipping beauty fix.');
        return;
    }

    // Get all direct children of beauty (the subcategories)
    const beautySubcats = await prisma.category.findMany({
        where: { parentId: beautyRoot.id },
        select: { id: true, slug: true, name: true },
        orderBy: { sortOrder: 'asc' },
    });

    if (beautySubcats.length === 0) {
        console.log('No beauty subcategories found. Skipping beauty fix.');
        return;
    }

    console.log(`Beauty subcategories: ${beautySubcats.map(c => c.slug).join(', ')}`);

    // Count products in each subcategory
    const counts = await Promise.all(
        beautySubcats.map(async (cat) => {
            const count = await prisma.product.count({
                where: { categoryId: cat.id, status: 'published' },
            });
            return { ...cat, count };
        })
    );

    counts.forEach(c => console.log(`  ${c.slug}: ${c.count} products`));

    const emptyCats = counts.filter(c => c.count < MIN_PER_BEAUTY_CAT);
    if (emptyCats.length === 0) {
        console.log(`All beauty subcategories already have >= ${MIN_PER_BEAUTY_CAT} products. Nothing to do.`);
        return;
    }

    console.log(`\n${emptyCats.length} subcategories need products (< ${MIN_PER_BEAUTY_CAT} each).`);

    // Find all beauty products (from any subcategory) sorted by category size desc
    // so we borrow from the most-populated ones first
    const sortedByCount = [...counts].sort((a, b) => b.count - a.count);

    // Build a pool of (productId, currentCategoryId) from overpopulated categories.
    // "Overpopulated" = has more than MIN_PER_BEAUTY_CAT * 2 products (safe to borrow from).
    // If nothing is overpopulated, borrow from whatever has the most.
    const donorCats = sortedByCount.filter(c => c.count > MIN_PER_BEAUTY_CAT * 2);
    const sourceCats = donorCats.length > 0 ? donorCats : sortedByCount.slice(0, 1);

    let totalMoved = 0;

    for (const emptyCat of emptyCats) {
        const needed = MIN_PER_BEAUTY_CAT - emptyCat.count;
        let moved = 0;

        for (const source of sourceCats) {
            if (moved >= needed) break;

            // How many we can safely lend (keep at least MIN_PER_BEAUTY_CAT in source)
            const currentCount = await prisma.product.count({
                where: { categoryId: source.id, status: 'published' },
            });
            const canLend = Math.max(0, currentCount - MIN_PER_BEAUTY_CAT);
            if (canLend === 0) continue;

            const toMove = Math.min(needed - moved, canLend);

            // Grab the IDs to reassign (take the tail — keep "first" products in source)
            const products = await prisma.product.findMany({
                where: { categoryId: source.id, status: 'published' },
                select: { id: true },
                orderBy: { createdAt: 'desc' }, // borrow recently-added ones
                take: toMove,
            });

            if (products.length === 0) continue;

            const ids = products.map(p => p.id);
            await prisma.product.updateMany({
                where: { id: { in: ids } },
                data: { categoryId: emptyCat.id },
            });

            console.log(`  Moved ${ids.length} products from "${source.slug}" → "${emptyCat.slug}"`);
            moved += ids.length;
            totalMoved += ids.length;
        }

        if (moved < needed) {
            console.warn(`  Warning: could only move ${moved}/${needed} needed for "${emptyCat.slug}"`);
        }
    }

    console.log(`\nBeauty fix complete. Total products reassigned: ${totalMoved}`);

    // Print final state
    console.log('\nFinal beauty subcategory counts:');
    for (const cat of beautySubcats) {
        const count = await prisma.product.count({
            where: { categoryId: cat.id, status: 'published' },
        });
        console.log(`  ${cat.slug}: ${count} products`);
    }
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('Starting fix-trending-and-beauty.js');
    console.log(`Config: TRENDING_COUNT=${TRENDING_COUNT}, MIN_PER_BEAUTY_CAT=${MIN_PER_BEAUTY_CAT}`);

    await fixTrending();
    await fixBeautySubcategories();

    console.log('\n✅ All done.');
}

main()
    .catch((err) => {
        console.error('❌ Script failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
