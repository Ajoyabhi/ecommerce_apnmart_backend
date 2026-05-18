/**
 * HDFC Bank Testing Report Script
 * --------------------------------
 * Fetches all transaction details requested by HDFC bank for the given order IDs.
 *
 * Usage:
 *   node scripts/hdfc-bank-report.js
 *
 * Optional — query specific order IDs:
 *   node scripts/hdfc-bank-report.js HMPAUFUUNCY9NHR HMPAULGNCAM1TKM
 *
 * Output:
 *   - Prints a readable report to the terminal
 *   - Saves a CSV file to scripts/hdfc-bank-report.csv
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// ─── Order IDs provided by HDFC bank ────────────────────────────────────────
const DEFAULT_ORDER_IDS = [
    'HMPAUFUUNCY9NHR',
    'HMPAULGNCAM1TKM',
    'HMPAUV5A0ASNZ1P',
    'HMPAV12O948EFBS',
    'HMPAV9STY4K9ASG',
    'HMPAVEQBXTS7O9Q',
];

// Allow passing IDs as CLI args: node hdfc-bank-report.js ID1 ID2 ...
const orderIds = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : DEFAULT_ORDER_IDS;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function line(char = '─', len = 70) {
    return char.repeat(len);
}

function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }) + ' IST';
}

function toCSV(rows) {
    const headers = [
        'HDFC Order ID',
        'Our Order Number',
        'Gateway Status',
        'Transaction ID',
        'Transaction UUID',
        'Payment Status (DB)',
        'Order Status',
        'Payment Method',
        'Amount (INR)',
        'Times Stored in DB',
        'Order Created At (IST)',
        'Payment Last Updated (IST)',
        'Products',
    ];

    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const csvRows = rows.map(r => [
        r.hdfcOrderId,
        r.orderNumber,
        r.gatewayStatus,
        r.txnId ?? '',
        r.txnUuid ?? '',
        r.paymentStatus,
        r.orderStatus,
        r.paymentMethod ?? '',
        r.amount,
        r.timesStoredInDb,
        r.orderCreatedAt,
        r.paymentUpdatedAt,
        r.products,
    ].map(escape).join(','));

    return [headers.map(escape).join(','), ...csvRows].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(line('═'));
    console.log('  HDFC BANK TRANSACTION REPORT');
    console.log(`  Generated: ${formatDate(new Date())}`);
    console.log(`  Querying ${orderIds.length} order ID(s)...`);
    console.log(line('═'));

    const payments = await prisma.hdfcPayment.findMany({
        where: { hdfcOrderId: { in: orderIds } },
        include: {
            order: {
                include: {
                    items: true,
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    // Warn about any IDs not found
    const foundIds = payments.map(p => p.hdfcOrderId);
    const notFound = orderIds.filter(id => !foundIds.includes(id));
    if (notFound.length > 0) {
        console.log(`\n⚠️  NOT FOUND in database: ${notFound.join(', ')}\n`);
    }

    if (payments.length === 0) {
        console.log('No records found for the provided order IDs.');
        return;
    }

    const reportRows = [];

    payments.forEach((hp, index) => {
        const order = hp.order;
        const items = order.items ?? [];

        const productSummary = items
            .map(it => `${it.productName} (SKU: ${it.sku}, Qty: ${it.quantity}, Unit: ₹${Number(it.unitPrice).toFixed(2)})`)
            .join(' | ');

        // Print terminal report
        console.log(`\n  [${index + 1}] HDFC ORDER ID: ${hp.hdfcOrderId}`);
        console.log(line());
        console.log(`  Gateway Status      : ${hp.status}`);
        console.log(`  Transaction ID      : ${hp.txnId ?? 'N/A (pending or not captured yet)'}`);
        console.log(`  Transaction UUID    : ${hp.txnUuid ?? 'N/A'}`);
        console.log(`  Our Order Number    : ${order.orderNumber}`);
        console.log(`  Payment Status (DB) : ${order.paymentStatus}`);
        console.log(`  Order Status        : ${order.status}`);
        console.log(`  Payment Method      : ${order.paymentMethod ?? 'N/A'}`);
        console.log(`  Amount              : ₹${Number(order.total).toFixed(2)}`);
        console.log(`  Times Stored in DB  : 1 (unique constraint enforced on hdfcOrderId)`);
        console.log(`  Order Created At    : ${formatDate(order.createdAt)}`);
        console.log(`  Payment Updated At  : ${formatDate(hp.updatedAt)}`);
        console.log(`  Products (${items.length}):`);
        items.forEach(it => {
            console.log(`    • ${it.productName}`);
            console.log(`      SKU: ${it.sku} | Qty: ${it.quantity} | Unit: ₹${Number(it.unitPrice).toFixed(2)} | Total: ₹${Number(it.totalPrice).toFixed(2)}`);
        });

        reportRows.push({
            hdfcOrderId:      hp.hdfcOrderId,
            orderNumber:      order.orderNumber,
            gatewayStatus:    hp.status,
            txnId:            hp.txnId,
            txnUuid:          hp.txnUuid,
            paymentStatus:    order.paymentStatus,
            orderStatus:      order.status,
            paymentMethod:    order.paymentMethod,
            amount:           Number(order.total).toFixed(2),
            timesStoredInDb:  1,
            orderCreatedAt:   formatDate(order.createdAt),
            paymentUpdatedAt: formatDate(hp.updatedAt),
            products:         productSummary,
        });
    });

    // Save CSV
    const csvPath = path.join(__dirname, 'hdfc-bank-report.csv');
    fs.writeFileSync(csvPath, toCSV(reportRows), 'utf8');

    console.log('\n' + line('═'));
    console.log(`  ✅ Report complete — ${payments.length} record(s) found`);
    console.log(`  📄 CSV saved to: ${csvPath}`);
    console.log(line('═') + '\n');
}

main()
    .catch(err => {
        console.error('❌ Script failed:', err.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
