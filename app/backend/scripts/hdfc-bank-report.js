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
// May 2026 bank testing IDs — provided by HDFC for transaction verification
const DEFAULT_ORDER_IDS = [
    'HMPAW67WP42KCMI',
    'HMPAWQT0LEGX9ZD',
    'HMPAWXF939LCJ94',
    'HMPAX851PV9HHJV',
    'HMPB4KXPH28POHX',
    'HMPB556W0W6NLQ3',
    'HMPB5AQAD7Q36NV',
    'HMPB5EDZ1BD2TGO',
    'HMPC5SEE7ZVQBYA',
    'HMPC61OE3K4J3QW',
    'HMPC6EIKDHOKNB3',
    'HMPC6JBL993NJHA',
    'HMPC6THGWIFYIBI',
    'HMPC7A4B8W38AIB',
    'HMPC7FRSD110GCQ',
    'HMPC6ZX5B5HXODI',
    'HMPC743LMMVI0XT',
    'HMPC7TK2JIMN867',
    'HMPC7PMCW0O4M9R',
    'HMPC7XBRUBDO18G',
    'HMPC7YNA4UYYUDX',
    'HMPC82UBRR2BIUN',
    'HMPC89U8MVMZ5O6',
    'HMPC8BF1KWZI7YW',
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
    // Columns match the bank's Excel template exactly
    const headers = [
        '#',
        'HDFC Order ID',
        'Our Order Number',
        'Transaction status',
        'Transaction amounts',
        'Number of times each order ID is stored in database for each transaction',
        'Timestamp of each transaction',
        'Details of products associated with each order id (Product Name, Product Type etc.)',
    ];

    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const csvRows = rows.map((r, i) => [
        i + 1,
        r.hdfcOrderId,
        r.orderNumber,
        r.gatewayStatus,
        `Rs. ${r.amount}`,
        r.timesStoredInDb,
        r.orderCreatedAt,
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
