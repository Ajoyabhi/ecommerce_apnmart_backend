const { prisma } = require('../../../config/database');
const {
  generateAndSaveInvoice,
  getInvoiceFilePath,
  invoiceExists,
} = require('../../../services/invoice.service');

// Invoice numbering is derived from the AccuzPay reference id.
function invoiceNumberFor(payment) {
  return `ACCUZ-${payment.referenceId}`;
}

// Builds the order-shaped object the invoice generator expects from an
// AccuzpayPayment (with items included).
function buildOrderObj(payment) {
  const addr = (payment.shippingAddress && typeof payment.shippingAddress === 'object')
    ? payment.shippingAddress : {};

  return {
    orderNumber:    invoiceNumberFor(payment),
    createdAt:      payment.createdAt,
    total:          payment.amount,
    subtotal:       payment.amount,
    taxAmount:      0,
    shippingAmount: 0,
    paymentMethod:  'UPI',
    paymentStatus:  'paid',
    shippingAddress: {
      fullName:     payment.customerName || '',
      phone:        payment.customerPhone || '',
      addressLine1: addr.line1 || '',
      addressLine2: addr.line2 || '',
      city:         addr.city  || '',
      state:        addr.state || '',
      pincode:      addr.pincode || '',
      country:      addr.country || 'India',
    },
    user: {
      name:  payment.customerName  || '',
      email: payment.customerEmail || '',
    },
    items: payment.items.map(item => ({
      productName: item.productName,
      variantName: item.variantName || '',
      sku:         item.variant?.sku || item.product?.sku || '',
      unitPrice:   item.unitPrice,
      quantity:    item.quantity,
      totalPrice:  item.totalPrice,
    })),
  };
}

/**
 * Ensure the invoice PDF for a payment exists on disk, generating it if needed.
 * Returns the file path. Safe to call repeatedly (cached after first render).
 * Used by both the invoice worker (pre-generation) and the download route (fallback).
 */
async function ensureInvoice(paymentId) {
  const payment = await prisma.accuzpayPayment.findUnique({
    where:   { id: paymentId },
    include: { items: { include: { product: true, variant: true } } },
  });

  if (!payment) throw new Error(`accuzpay payment ${paymentId} not found`);
  if (!payment.items.length) throw new Error(`accuzpay payment ${paymentId} has no items`);

  const orderNumber = invoiceNumberFor(payment);
  if (invoiceExists(orderNumber)) return getInvoiceFilePath(orderNumber);

  return generateAndSaveInvoice(buildOrderObj(payment));
}

module.exports = { buildOrderObj, ensureInvoice, invoiceNumberFor };
