#!/usr/bin/env node
/**
 * Update an order's createdAt date and regenerate its invoice PDF.
 *
 * Usage (from backend directory):
 *   node scripts/update-invoice-date.js <orderNumber> <date>
 *
 * Date formats accepted:
 *   YYYY-MM-DD          e.g. 2026-03-15
 *   DD-MM-YYYY          e.g. 15-03-2026
 *   DD/MM/YYYY          e.g. 15/03/2026
 *
 * Examples:
 *   node scripts/update-invoice-date.js ORD-00123 2026-03-15
 *   node scripts/update-invoice-date.js ORD-00123 15-03-2026
 *
 * Env: DATABASE_URL (Prisma)
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// ── Parse CLI args ────────────────────────────────────────────────────────────

const [, , orderNumber, dateArg] = process.argv;

if (!orderNumber || !dateArg) {
    console.error('Usage: node scripts/update-invoice-date.js <orderNumber> <date>');
    console.error('  date formats: YYYY-MM-DD  |  DD-MM-YYYY  |  DD/MM/YYYY');
    process.exit(1);
}

function parseDate(raw) {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const d = new Date(raw + 'T00:00:00.000Z');
        if (!isNaN(d)) return d;
    }
    // DD-MM-YYYY or DD/MM/YYYY
    const m = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (m) {
        const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z`);
        if (!isNaN(d)) return d;
    }
    return null;
}

const newDate = parseDate(dateArg);
if (!newDate) {
    console.error(`Invalid date: "${dateArg}". Use YYYY-MM-DD, DD-MM-YYYY, or DD/MM/YYYY.`);
    process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    // 1. Fetch order
    const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
            items: true,
        },
    });

    if (!order) {
        console.error(`Order not found: ${orderNumber}`);
        process.exit(1);
    }

    console.log(`Found order ${orderNumber} (current date: ${order.createdAt.toISOString().split('T')[0]})`);

    // 2. Update createdAt in DB
    await prisma.order.update({
        where: { orderNumber },
        data: { createdAt: newDate },
    });

    console.log(`Updated createdAt → ${newDate.toISOString().split('T')[0]}`);

    // 3. Delete old invoice PDF so it gets regenerated fresh
    const { getInvoiceFilePath, generateAndSaveInvoice } = require('../src/services/invoice.service');

    const oldPdf = getInvoiceFilePath(orderNumber);
    if (fs.existsSync(oldPdf)) {
        fs.unlinkSync(oldPdf);
        console.log(`Deleted old invoice: ${path.basename(oldPdf)}`);
    }

    // 4. Regenerate invoice with updated date
    const updatedOrder = { ...order, createdAt: newDate };
    const savedPath = await generateAndSaveInvoice(updatedOrder);

    console.log(`Invoice regenerated: ${savedPath}`);
    console.log('Done.');
}

main()
    .catch((err) => {
        console.error('Error:', err.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
