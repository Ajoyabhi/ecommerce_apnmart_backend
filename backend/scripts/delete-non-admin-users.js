#!/usr/bin/env node
/**
 * Deletes all users from PostgreSQL except those with role ADMIN.
 * Run from backend directory: node scripts/delete-non-admin-users.js
 * Requires: DATABASE_URL in .env (or environment).
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    // 1. Count admins and non-admins
    const [adminCount, nonAdminCount] = await Promise.all([
        prisma.user.count({ where: { role: 'ADMIN' } }),
        prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
    ]);

    console.log(`Admin users (will keep): ${adminCount}`);
    console.log(`Non-admin users (will delete): ${nonAdminCount}`);

    if (nonAdminCount === 0) {
        console.log('Nothing to delete.');
        return;
    }

    const nonAdminIds = await prisma.user.findMany({
        where: { role: { not: 'ADMIN' } },
        select: { id: true },
    }).then(users => users.map(u => u.id));

    console.log('\nDeleting related data for non-admin users...');

    await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { userId: { in: nonAdminIds } } });
        await tx.savedCard.deleteMany({ where: { userId: { in: nonAdminIds } } });
        await tx.wishlistItem.deleteMany({ where: { userId: { in: nonAdminIds } } });
        await tx.cart.deleteMany({ where: { userId: { in: nonAdminIds } } });
        await tx.address.deleteMany({ where: { userId: { in: nonAdminIds } } });
        await tx.order.updateMany({
            where: { userId: { in: nonAdminIds } },
            data: { userId: null },
        });
        const result = await tx.user.deleteMany({
            where: { role: { not: 'ADMIN' } },
        });
        console.log(`Deleted ${result.count} user(s).`);
    });

    const remaining = await prisma.user.count();
    console.log(`\nDone. Total users remaining: ${remaining}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
