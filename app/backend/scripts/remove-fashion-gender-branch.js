const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const { ProductRichContent, CategoryFeedSection } = require('../src/models');

require('dotenv').config();

const prisma = new PrismaClient();

async function removeFashionGenderBranch() {
    console.log('🔍 Looking for bogus "Gender" branch under Fashion...');

    // 1. Find the root Fashion category
    const fashion = await prisma.category.findFirst({
        where: { slug: 'fashion' }
    });

    if (!fashion) {
        console.log('⚠️ Root "fashion" category not found. Nothing to delete.');
        return;
    }

    // 2. Find direct child named "Gender" under Fashion
    const genderCategory = await prisma.category.findFirst({
        where: {
            parentId: fashion.id,
            name: 'Gender'
        }
    });

    if (!genderCategory) {
        console.log('✅ No "Gender" child under Fashion found. Nothing to delete.');
        return;
    }

    console.log('🧹 Removing bogus "Gender" branch under Fashion...');

    // Helper: collect all descendant category ids starting from a given id
    const collectDescendantCategoryIds = async (rootId) => {
        const ids = [rootId];
        const queue = [rootId];

        while (queue.length) {
            const currentId = queue.shift();
            const children = await prisma.category.findMany({
                where: { parentId: currentId },
                select: { id: true }
            });
            for (const child of children) {
                ids.push(child.id);
                queue.push(child.id);
            }
        }
        return ids;
    };

    const categoryIdsToDelete = await collectDescendantCategoryIds(genderCategory.id);
    console.log('   Categories to delete (Gender subtree):', categoryIdsToDelete.length);

    if (!categoryIdsToDelete.length) {
        console.log('✅ No categories found under "Gender". Nothing else to do.');
        return;
    }

    // 3. Find all products in those categories
    const products = await prisma.product.findMany({
        where: { categoryId: { in: categoryIdsToDelete } },
        select: { id: true }
    });
    const productIds = products.map((p) => p.id);
    console.log('   Products linked to Gender subtree:', productIds.length);

    if (productIds.length) {
        // 4. Clean up relational dependents referencing those products
        console.log('   Deleting dependent data (orders, variants, inventory, wishlist, etc.)...');

        await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.cart.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.inventory.deleteMany({
            where: { variant: { productId: { in: productIds } } }
        });
        await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });

        // 5. Delete products themselves
        await prisma.product.deleteMany({ where: { id: { in: productIds } } });

        // 6. Clean up Mongo rich content / sections tied to these products or categories
        await ProductRichContent.deleteMany({ pg_id: { $in: productIds } });
        await CategoryFeedSection.deleteMany({
            categorySlug: { $regex: /^fashion-gender/i }
        });
    }

    // 7. Finally, delete the categories in the Gender subtree (children first)
    console.log('   Deleting categories in "Gender" subtree...');
    // Delete leaf categories first by repeatedly deleting categories that have no children
    let remaining = new Set(categoryIdsToDelete);
    while (remaining.size) {
        const batch = Array.from(remaining);
        let deletedAny = false;
        for (const id of batch) {
            const child = await prisma.category.findFirst({
                where: { parentId: id },
                select: { id: true }
            });
            if (!child) {
                await prisma.category.delete({ where: { id } }).catch(() => {});
                remaining.delete(id);
                deletedAny = true;
            }
        }
        if (!deletedAny) break;
    }

    console.log('✅ "Gender" branch and related data removed successfully.');
}

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await removeFashionGenderBranch();
    } catch (err) {
        console.error('❌ Failed to remove "Gender" branch:', err);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
        await mongoose.disconnect();
    }
}

main();

