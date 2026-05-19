/**
 * Invoice generation service — GST-compliant tax invoice.
 *
 * GST rules applied:
 *  - Unit price ≤ 2500 → 5% GST  (2.5% CGST + 2.5% SGST  OR  5% IGST)
 *  - Unit price > 2500 → 18% GST (9%   CGST + 9%   SGST  OR  18% IGST)
 *  - Buyer state = Uttar Pradesh (seller state) → intrastate → CGST + SGST
 *  - Buyer state ≠ Uttar Pradesh → interstate  → IGST only
 *  - All prices in DB are inclusive of GST (MRP); we back-calculate taxable value.
 *  - Shipping shown separately (no GST applied on shipping for simplicity).
 */

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const logger = require('../utils/logger');

const INVOICES_DIR = path.join(__dirname, '..', '..', 'uploads', 'invoices');
const LOGO_PATH = path.join(__dirname, '..', '..', 'product_images', 'brand_logo', 'apnamart_logo.png');
const SIGNATURE_PATH = path.join(__dirname, '..', '..', 'product_images', 'brand_logo', 'invoice_signature.png');

if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

// Embed logo as base64 so puppeteer doesn't need to fetch it over HTTP
function getLogoDataUri() {
    try {
        const data = fs.readFileSync(LOGO_PATH);
        return `data:image/png;base64,${data.toString('base64')}`;
    } catch {
        return null;
    }
}

const LOGO_DATA_URI = getLogoDataUri();

function getSignatureDataUri() {
    try {
        const data = fs.readFileSync(SIGNATURE_PATH);
        return `data:image/png;base64,${data.toString('base64')}`;
    } catch {
        return null;
    }
}

const SIGNATURE_DATA_URI = getSignatureDataUri();

const STORE_NAME = process.env.STORE_NAME || 'Apnamart';
const COMPANY_NAME = process.env.COMPANY_NAME || '';
const STORE_GSTIN = process.env.STORE_GSTIN || 'Not Registered';
const STORE_ADDRESS_LINE1 = process.env.STORE_ADDRESS_LINE1 || '';
const STORE_ADDRESS_LINE2 = process.env.STORE_ADDRESS_LINE2 || '';
const STORE_EMAIL = process.env.STORE_EMAIL || 'support@apnamart.com';
const STORE_PHONE = process.env.STORE_PHONE || '';
const SELLER_STATE = 'Uttar Pradesh'; // seller's registered GST state

// ─── HSN Code Mapping ────────────────────────────────────────────────────────

const HSN_RULES = [
    // Footwear — check before clothing to avoid "shoe" hitting "t-shirt" etc.
    { keywords: ['formal leather shoe', 'leather shoe', 'formal shoe', 'boot'], hsn: '6403' },
    { keywords: ['heel', 'pump', 'wedge'], hsn: '6403' },
    { keywords: ['sandal', 'floater'], hsn: '6402' },
    { keywords: ['slipper', 'flip flop', 'flip-flop', 'chappal'], hsn: '6402' },
    { keywords: ['rubber shoe', 'pvc shoe', 'canvas shoe', 'sneaker', 'sports shoe', 'casual shoe', 'women shoe', 'ladies shoe', 'running shoe', 'training shoe'], hsn: '6404' },
    { keywords: ['shoe', 'footwear'], hsn: '6404' },

    // Clothing
    { keywords: ['polo', 't-shirt', 'tshirt', 't shirt'], hsn: '6109' },
    { keywords: ['innerwear', 'vest', 'baniyan', 'underwear', 'brief', 'trunk'], hsn: '6109' },
    { keywords: ['bra', 'brassiere'], hsn: '6212' },
    { keywords: ['shirt'], hsn: '6205' },
    { keywords: ['hoodie', 'sweatshirt', 'pullover'], hsn: '6110' },
    { keywords: ['jacket'], hsn: '6201' },
    { keywords: ['blazer', 'coat', 'suit jacket'], hsn: '6203' },
    { keywords: ['jeans', 'denim', 'trouser', 'trousers', 'pant', 'chino'], hsn: '6203' },
    { keywords: ['track pant', 'trackpant', 'jogger'], hsn: '6103' },
    { keywords: ['legging'], hsn: '6104' },
    { keywords: ['shorts', 'short pant'], hsn: '6103' },
    { keywords: ['night suit', 'nightsuit', 'pyjama', 'pajama', 'nightwear'], hsn: '6107' },
    { keywords: ['kurti', 'kurta', 'ladies suit', 'salwar', 'churidar', 'anarkali', 'lehenga', 'ethnic', 'suit set', 'ladies ethnic'], hsn: '6204' },
    { keywords: ['saree', 'sari'], hsn: '5208' },
    { keywords: ['dupatta', 'stole', 'scarf'], hsn: '6214' },
    { keywords: ['kids', 'children', 'infant', 'baby', 'boy wear', 'girl wear'], hsn: '6209' },
    { keywords: ['sock', 'stockings'], hsn: '6115' },
    { keywords: ['cap', 'hat', 'beanie', 'beret', 'baseball cap'], hsn: '6505' },
];

function getHsnCode(productName) {
    const name = (productName || '').toLowerCase();
    for (const rule of HSN_RULES) {
        if (rule.keywords.some((kw) => name.includes(kw))) {
            return rule.hsn;
        }
    }
    return '6299'; // generic apparel fallback
}

// ─── GST logic ───────────────────────────────────────────────────────────────

/**
 * Returns the GST rate (5 or 18) for a given unit price.
 * threshold is per-unit price (not line total).
 */
function getGstRate(unitPrice) {
    return unitPrice > 2500 ? 18 : 5;
}

/**
 * Back-calculates the taxable (pre-GST) value from an MRP-inclusive price.
 * taxableValue = inclusivePrice / (1 + rate/100)
 */
function backCalcTaxable(inclusiveAmount, rate) {
    return inclusiveAmount / (1 + rate / 100);
}

/**
 * Returns whether the order is interstate (IGST) or intrastate (CGST+SGST).
 * Seller state is Uttar Pradesh.
 */
function isInterstate(shippingAddress) {
    const state = ((shippingAddress || {}).state || '').trim().toLowerCase();
    const UP_ALIASES = ['uttar pradesh', 'up', 'u.p.', 'u.p'];
    return !UP_ALIASES.includes(state);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInvoiceFilePath(orderNumber) {
    return path.join(INVOICES_DIR, `invoice-${orderNumber}.pdf`);
}

function invoiceExists(orderNumber) {
    return fs.existsSync(getInvoiceFilePath(orderNumber));
}

function decimalToNum(d) {
    if (d == null) return 0;
    if (typeof d === 'number') return d;
    return parseFloat(String(d)) || 0;
}

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(date) {
    const d = date ? new Date(date) : new Date();
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Invoice HTML builder ─────────────────────────────────────────────────────

function buildInvoiceHtml(order) {
    const invoiceNumber = `INV-${order.orderNumber}`;
    const invoiceDate = formatDate(order.createdAt);
    const paymentMethod = (order.paymentMethod || '').toLowerCase() === 'cod'
        ? 'Cash on Delivery'
        : (order.paymentMethod || 'Prepaid').toUpperCase();

    const addr = (order.shippingAddress && typeof order.shippingAddress === 'object')
        ? order.shippingAddress
        : {};

    const interstate = isInterstate(addr);
    const shipping = decimalToNum(order.shippingAmount);
    const grandTotal = decimalToNum(order.total);

    // ── Per-item calculations ──────────────────────────────────────────────
    const itemsData = (order.items || []).map((item) => {
        const unitPrice = decimalToNum(item.unitPrice);
        const qty = item.quantity;
        const lineTotal = decimalToNum(item.totalPrice); // MRP-inclusive total
        const rate = getGstRate(unitPrice);
        const halfRate = rate / 2;

        // Back-calculate from MRP-inclusive line total
        const taxableLineTotal = backCalcTaxable(lineTotal, rate);
        const totalGstAmt = lineTotal - taxableLineTotal;
        const taxableUnitPrice = backCalcTaxable(unitPrice, rate);

        const cgstAmt = interstate ? 0 : totalGstAmt / 2;
        const sgstAmt = interstate ? 0 : totalGstAmt / 2;
        const igstAmt = interstate ? totalGstAmt : 0;

        return {
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            hsn: getHsnCode(item.productName),
            qty,
            unitPrice,
            taxableUnitPrice,
            lineTotal,
            taxableLineTotal,
            rate,
            halfRate,
            cgstAmt,
            sgstAmt,
            igstAmt,
            totalGstAmt,
        };
    });

    // ── Summary totals ─────────────────────────────────────────────────────
    const totalTaxableValue = itemsData.reduce((s, it) => s + it.taxableLineTotal, 0);
    const totalCgst = itemsData.reduce((s, it) => s + it.cgstAmt, 0);
    const totalSgst = itemsData.reduce((s, it) => s + it.sgstAmt, 0);
    const totalIgst = itemsData.reduce((s, it) => s + it.igstAmt, 0);
    const totalItemsGross = itemsData.reduce((s, it) => s + it.lineTotal, 0);

    // ── Table rows ─────────────────────────────────────────────────────────
    const taxHeaderCols = interstate
        ? `<th class="center" style="width:48px;">IGST %</th><th class="right" style="width:65px;">IGST Amt</th>`
        : `<th class="center" style="width:42px;">CGST %</th><th class="right" style="width:60px;">CGST Amt</th>
           <th class="center" style="width:42px;">SGST %</th><th class="right" style="width:60px;">SGST Amt</th>`;

    const itemRows = itemsData.map((it, i) => {
        const taxCols = interstate
            ? `<td class="center">${it.rate}%</td><td class="right">₹${it.igstAmt.toFixed(2)}</td>`
            : `<td class="center">${it.halfRate}%</td><td class="right">₹${it.cgstAmt.toFixed(2)}</td>
               <td class="center">${it.halfRate}%</td><td class="right">₹${it.sgstAmt.toFixed(2)}</td>`;

        return `
        <tr>
            <td class="center">${i + 1}</td>
            <td>
                <div class="item-name">${esc(it.productName)}</div>
                ${it.variantName ? `<div class="item-variant">${esc(it.variantName)}</div>` : ''}
                ${it.sku ? `<div class="item-sku">SKU: ${esc(it.sku)}</div>` : ''}
            </td>
            <td class="center">${esc(it.hsn)}</td>
            <td class="center">${it.qty}</td>
            <td class="right">₹${it.taxableUnitPrice.toFixed(2)}</td>
            ${taxCols}
            <td class="right bold">₹${it.lineTotal.toFixed(2)}</td>
        </tr>`;
    }).join('');

    // ── Summary tax rows (grouped by rate if mixed 5%+18%) ─────────────────
    const taxSummaryRows = (() => {
        const grouped = {};
        itemsData.forEach((it) => {
            const key = it.rate;
            if (!grouped[key]) grouped[key] = { rate: it.rate, halfRate: it.halfRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
            grouped[key].taxable += it.taxableLineTotal;
            grouped[key].cgst += it.cgstAmt;
            grouped[key].sgst += it.sgstAmt;
            grouped[key].igst += it.igstAmt;
        });
        return Object.values(grouped).sort((a, b) => a.rate - b.rate).map((g) => {
            if (interstate) {
                return `<tr>
                  <td class="label">IGST @ ${g.rate}% (on ₹${g.taxable.toFixed(2)})</td>
                  <td class="amount">₹${g.igst.toFixed(2)}</td>
                </tr>`;
            }
            return `<tr>
              <td class="label">CGST @ ${g.halfRate}% (on ₹${g.taxable.toFixed(2)})</td>
              <td class="amount">₹${g.cgst.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="label">SGST @ ${g.halfRate}% (on ₹${g.taxable.toFixed(2)})</td>
              <td class="amount">₹${g.sgst.toFixed(2)}</td>
            </tr>`;
        }).join('');
    })();

    const taxTypeBadge = interstate
        ? `<span class="tax-badge igst">Interstate Supply — IGST</span>`
        : `<span class="tax-badge intra">Intrastate Supply — CGST + SGST (Uttar Pradesh)</span>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tax Invoice – ${esc(invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11px;
    color: #1a1a1a;
    background: #fff;
    padding: 24px 32px;
  }
  .invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 16px;
    margin-bottom: 16px;
  }
  .store-logo { height: 90px; width: auto; object-fit: contain; display: block; margin-bottom: 6px; }
  .store-name { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #111; }
  .store-meta { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.6; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 18px; font-weight: 700; color: #111; letter-spacing: 1px; text-transform: uppercase; }
  .invoice-title .inv-number { font-size: 12px; font-weight: 600; color: #444; margin-top: 4px; }
  .invoice-title .inv-date { font-size: 10px; color: #666; margin-top: 2px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
  .meta-box { border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; }
  .meta-box h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; font-weight: 600; margin-bottom: 6px; }
  .meta-box p { font-size: 11px; color: #222; line-height: 1.7; }
  .meta-box .highlight { font-weight: 600; font-size: 12px; color: #111; }
  .tax-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.3px;
    margin-bottom: 10px;
  }
  .tax-badge.igst { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .tax-badge.intra { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table thead tr { background: #1a1a1a; color: #fff; }
  table thead th { padding: 8px 8px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; text-align: left; }
  table thead th.center { text-align: center; }
  table thead th.right { text-align: right; }
  table tbody tr { border-bottom: 1px solid #eee; }
  table tbody tr:nth-child(even) { background: #f9f9f9; }
  table tbody td { padding: 7px 8px; vertical-align: top; }
  td.center { text-align: center; }
  td.right { text-align: right; }
  td.bold { font-weight: 600; }
  .item-name { font-weight: 500; font-size: 11px; }
  .item-variant { font-size: 9.5px; color: #666; margin-top: 1px; }
  .item-sku { font-size: 9px; color: #999; font-family: monospace; margin-top: 1px; }
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  .totals-table { width: 300px; }
  .totals-table td { padding: 4px 8px; font-size: 11px; }
  .totals-table .label { color: #555; }
  .totals-table .amount { text-align: right; font-weight: 500; }
  .totals-table .section-sep td { border-top: 1px solid #e0e0e0; padding-top: 6px; }
  .totals-table .grand-total td { border-top: 2px solid #1a1a1a; font-size: 13px; font-weight: 700; padding-top: 8px; }
  .payment-info { border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 10.5px; color: #444; }
  .payment-info span { font-weight: 600; color: #111; }
  .footer { border-top: 1px solid #ddd; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-note { font-size: 9px; color: #888; line-height: 1.7; max-width: 320px; }
  .signature-box { text-align: right; font-size: 10px; color: #555; }
  .signature-img { height: 56px; width: auto; object-fit: contain; display: inline-block; margin-bottom: 2px; }
  .signature-box .sig-line { border-top: 1px solid #aaa; padding-top: 4px; }
  .paid-badge {
    display: inline-block; background: #d1fae5; color: #065f46;
    border: 1px solid #6ee7b7; border-radius: 4px; padding: 1px 8px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
    margin-left: 8px; vertical-align: middle;
  }
</style>
</head>
<body>

<div class="invoice-header">
  <div>
    ${LOGO_DATA_URI ? `<img src="${LOGO_DATA_URI}" class="store-logo" alt="${esc(STORE_NAME)} logo"><div class="store-name">${esc(STORE_NAME)}</div>` : `<div class="store-name">${esc(STORE_NAME)}</div>`}
    <div class="store-meta">
      ${COMPANY_NAME ? `<strong>${esc(COMPANY_NAME)}</strong><br>` : ''}
      ${STORE_ADDRESS_LINE1 ? `${esc(STORE_ADDRESS_LINE1)}<br>` : ''}
      ${STORE_ADDRESS_LINE2 ? `${esc(STORE_ADDRESS_LINE2)}<br>` : ''}
      ${STORE_EMAIL ? `Email: ${esc(STORE_EMAIL)}` : ''}${STORE_PHONE ? ` &nbsp;|&nbsp; Ph: ${esc(STORE_PHONE)}` : ''}<br>
      GSTIN: <strong>${esc(STORE_GSTIN)}</strong> &nbsp;|&nbsp; State: ${esc(SELLER_STATE)}
    </div>
  </div>
  <div class="invoice-title">
    <h1>Tax Invoice</h1>
    <div class="inv-number">${esc(invoiceNumber)}</div>
    <div class="inv-date">Date: ${invoiceDate}</div>
  </div>
</div>

<div class="meta-grid">
  <div class="meta-box">
    <h3>Bill To / Ship To</h3>
    <p>
      <span class="highlight">${esc(addr.fullName || '')}</span><br>
      ${addr.addressLine1 ? `${esc(addr.addressLine1)}<br>` : ''}
      ${addr.addressLine2 ? `${esc(addr.addressLine2)}<br>` : ''}
      ${addr.city ? `${esc(addr.city)}, ` : ''}${addr.state ? `${esc(addr.state)} ` : ''}${(addr.pincode || addr.postalCode) ? esc(addr.pincode || addr.postalCode) : ''}<br>
      ${addr.country ? `${esc(addr.country)}<br>` : ''}
      ${addr.phone ? `Ph: ${esc(addr.phone)}` : ''}
    </p>
  </div>
  <div class="meta-box">
    <h3>Order Details</h3>
    <p>
      <strong>Order No:</strong> ${esc(order.orderNumber)}<br>
      <strong>Invoice Date:</strong> ${invoiceDate}<br>
      <strong>Payment:</strong> ${esc(paymentMethod)}
      ${order.paymentStatus === 'paid' ? '<span class="paid-badge">Paid</span>' : ''}<br>
      ${order.trackingNumber ? `<strong>Tracking:</strong> ${esc(order.trackingNumber)}<br>` : ''}
      <strong>Supply Type:</strong> ${interstate ? 'Inter-State' : 'Intra-State (UP)'}
    </p>
  </div>
</div>

${taxTypeBadge}

<table>
  <thead>
    <tr>
      <th class="center" style="width:28px;">#</th>
      <th>Item Description</th>
      <th class="center" style="width:50px;">HSN</th>
      <th class="center" style="width:32px;">Qty</th>
      <th class="right" style="width:75px;">Taxable Value</th>
      ${taxHeaderCols}
      <th class="right" style="width:75px;">Total (Incl. GST)</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<div class="totals-section">
  <table class="totals-table">
    <tr>
      <td class="label">Total Taxable Value</td>
      <td class="amount">₹${totalTaxableValue.toFixed(2)}</td>
    </tr>
    ${taxSummaryRows}
    <tr class="section-sep">
      <td class="label">Total (Items incl. GST)</td>
      <td class="amount">₹${totalItemsGross.toFixed(2)}</td>
    </tr>
    <tr>
      <td class="label">Shipping Charges</td>
      <td class="amount">${shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`}</td>
    </tr>
    <tr class="grand-total">
      <td class="label">Grand Total</td>
      <td class="amount">₹${grandTotal.toFixed(2)}</td>
    </tr>
  </table>
</div>

<div class="payment-info">
  Payment method: <span>${esc(paymentMethod)}</span>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  Status: <span>${order.paymentStatus === 'paid' ? 'Paid' : (order.paymentMethod || '').toLowerCase() === 'cod' ? 'Pay on Delivery' : 'Pending'}</span>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  Supply type: <span>${interstate ? 'Inter-State (IGST)' : 'Intra-State UP (CGST+SGST)'}</span>
</div>

<div class="footer">
  <div class="footer-note">
    The goods sold are intended for end user consumption and not for resale.<br>
    This is a computer-generated invoice and does not require a physical signature.<br>
    GST amounts are back-calculated from MRP-inclusive prices.<br>
    For queries, contact ${esc(STORE_EMAIL)}.<br>
    Thank you for shopping with ${esc(STORE_NAME)}!
  </div>
  <div class="signature-box">
    ${SIGNATURE_DATA_URI ? `<img src="${SIGNATURE_DATA_URI}" class="signature-img" alt="Signature">` : ''}
    <div class="sig-line">Authorised Signatory<br>${esc(STORE_NAME)}</div>
  </div>
</div>

</body>
</html>`;
}

// ─── PDF generation ───────────────────────────────────────────────────────────

function findChromiumExecutable() {
    const candidates = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/snap/bin/chromium',
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

async function generateInvoicePdf(order) {
    const html = buildInvoiceHtml(order);
    const executablePath = findChromiumExecutable();
    if (!executablePath) {
        throw new Error('Chromium not found. Install it with: sudo apt-get install -y chromium-browser');
    }
    const browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });
        return pdfBuffer;
    } finally {
        await browser.close();
    }
}

async function generateAndSaveInvoice(order) {
    const filePath = getInvoiceFilePath(order.orderNumber);
    try {
        const pdfBuffer = await generateInvoicePdf(order);
        fs.writeFileSync(filePath, pdfBuffer);
        logger.info(`Invoice generated: ${filePath}`);
        return filePath;
    } catch (err) {
        logger.error(`Invoice generation failed for ${order.orderNumber}: ${err.message}`);
        throw err;
    }
}

function generateInvoiceAsync(order) {
    setImmediate(() => {
        generateAndSaveInvoice(order).catch((err) =>
            logger.error(`Async invoice generation failed: ${err.message}`)
        );
    });
}

module.exports = {
    getInvoiceFilePath,
    invoiceExists,
    buildInvoiceHtml,
    generateInvoicePdf,
    generateAndSaveInvoice,
    generateInvoiceAsync,
};
