/**
 * Delete all products whose rich media URLs point to the old B2 blob prefix
 * (e.g. https://f005.backblazeb2.com/file/Product2026/...).
 *
 * Usage (from app/backend):
 *   node scripts/delete-b2-products.js
 *
 * Make sure .env has DATABASE_URL and MONGODB_URI configured.
 */

const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const { ProductRichContent, Review } = require('../src/models');

require('dotenv').config();

const prisma = new PrismaClient();

// Hard-coded B2 media prefix to match existing blob URLs
const B2_MEDIA_PREFIX = process.env.B2_MEDIA_PREFIX ||
    'https://f005.backblazeb2.com/file/Product2026';

async function findProductIdsWithB2Media() {
    console.log('🔍 Looking for ProductRichContent documents with B2 media URLs...');

    const docs = await ProductRichContent.find(
        {
            'media_gallery.url': {
                $regex: '^' + B2_MEDIA_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            }
        },
        { pg_id: 1 }
    ).lean();

    const productIds = Array.from(
        new Set(
            docs
                .map((doc) => doc && doc.pg_id)
                .filter((id) => typeof id === 'string' && id.length > 0)
        )
    );

    console.log(`   Found ${productIds.length} products with B2 media URLs.`);
    return productIds;
}

async function deleteProductsAndDependents(productIds) {
    if (!productIds.length) {
        console.log('✅ No products to delete.');
        return;
    }

    console.log('🧹 Deleting relational dependents for these products...');

    // Order items and wishlist items that reference these products
    await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });

    // Inventory + variants for these products
    await prisma.inventory.deleteMany({
        where: {
            variant: {
                productId: { in: productIds }
            }
        }
    });
    await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });

    console.log('   Deleting products themselves...');
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });

    console.log('   Cleaning up Mongo rich content and reviews...');
    await ProductRichContent.deleteMany({ pg_id: { $in: productIds } });
    await Review.deleteMany({ product_id: { $in: productIds.map(String) } });

    console.log('✅ Deleted products with B2 media and their dependent data.');
}

async function main() {
    try {
        console.log('🚨 This script will delete all products whose media URLs start with:');
        console.log(`    ${B2_MEDIA_PREFIX}`);

        await mongoose.connect(process.env.MONGODB_URI);

        const productIds = await findProductIdsWithB2Media();
        await deleteProductsAndDependents(productIds);
    } catch (err) {
        console.error('❌ Failed to delete B2-backed products:', err);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
        await mongoose.disconnect();
    }
}

main();

