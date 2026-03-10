/**
 * Order-related emails: confirmation (user + admin), status change.
 * Sends asynchronously (non-blocking). Logs to EmailLog.
 */

const { prisma } = require('../config/database');
const { sendHtmlEmail } = require('./brevo.service');
const logger = require('../utils/logger');

const ADMIN_EMAILS = [
    'support@anpamart.com',
    'ajoyabhi1@gmail.com',
];

function decimalToNum(d) {
    if (d == null) return 0;
    if (typeof d === 'number') return d;
    const n = parseFloat(String(d));
    return Number.isFinite(n) ? n : 0;
}

function formatAddress(addr) {
    if (!addr || typeof addr !== 'object') return '—';
    const parts = [
        addr.fullName,
        addr.addressLine1,
        addr.addressLine2,
        [addr.city, addr.state, addr.pincode || addr.postalCode].filter(Boolean).join(', '),
        addr.country,
        addr.phone,
    ].filter(Boolean);
    return parts.join('<br/>');
}

function orderSummaryTable(order) {
    const items = (order.items || []).map(it => `
    <tr>
      <td style="padding:8px;border:1px solid #eee;">${String(it.productName || '').replace(/</g, '&lt;')}</td>
      <td style="padding:8px;border:1px solid #eee;">${it.quantity}</td>
      <td style="padding:8px;border:1px solid #eee;">₹${decimalToNum(it.unitPrice).toFixed(2)}</td>
      <td style="padding:8px;border:1px solid #eee;">₹${decimalToNum(it.totalPrice).toFixed(2)}</td>
    </tr>`).join('');
    const subtotal = decimalToNum(order.subtotal);
    const tax = decimalToNum(order.taxAmount);
    const shipping = decimalToNum(order.shippingAmount);
    const total = decimalToNum(order.total);
    const paymentLabel = (order.paymentMethod || '').toLowerCase() === 'cod' ? 'Cash on Delivery (COD)' : (order.paymentMethod || 'Prepaid');
    return `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;border:1px solid #eee;text-align:left;">Product</th>
          <th style="padding:8px;border:1px solid #eee;">Qty</th>
          <th style="padding:8px;border:1px solid #eee;">Unit Price</th>
          <th style="padding:8px;border:1px solid #eee;">Total</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
      <tfoot>
        <tr><td colspan="3" style="padding:8px;border:1px solid #eee;text-align:right;">Subtotal</td><td style="padding:8px;border:1px solid #eee;">₹${subtotal.toFixed(2)}</td></tr>
        <tr><td colspan="3" style="padding:8px;border:1px solid #eee;text-align:right;">Tax</td><td style="padding:8px;border:1px solid #eee;">₹${tax.toFixed(2)}</td></tr>
        <tr><td colspan="3" style="padding:8px;border:1px solid #eee;text-align:right;">Shipping</td><td style="padding:8px;border:1px solid #eee;">₹${shipping.toFixed(2)}</td></tr>
        <tr style="font-weight:bold;"><td colspan="3" style="padding:8px;border:1px solid #eee;text-align:right;">Total</td><td style="padding:8px;border:1px solid #eee;">₹${total.toFixed(2)}</td></tr>
      </tfoot>
    </table>
    <p><strong>Payment method:</strong> ${paymentLabel}</p>
    <p><strong>Delivery address:</strong></p>
    <p>${formatAddress(order.shippingAddress)}</p>
    <p><strong>Estimated delivery:</strong> 5–7 business days</p>
  `;
}

function orderSummaryTable(order) {
    const items = (order.items || []).map(it => `
    <tr>
      <td style="padding:8px;border:1px solid #eee;">${String(it.productName || '').replace(/</g, '&lt;')}</td>
      <td style="padding:8px;border:1px solid #eee;">${it.quantity}</td>
      <td style="padding:8px;border:1px solid #eee;">₹${decimalToNum(it.unitPrice).toFixed(2)}</td>
      <td style="padding:8px;border:1px solid #eee;">₹${decimalToNum(it.totalPrice).toFixed(2)}</td>
    </tr>`).join('');
    const subtotal = decimalToNum(order.subtotal);
    const tax = decimalToNum(order.taxAmount);
    const shipping = decimalToNum(order.shippingAmount);
    const total = decimalToNum(order.total);
    const paymentLabel = (order.paymentMethod || '').toLowerCase() === 'cod' ? 'Cash on Delivery (COD)' : (order.paymentMethod || 'Prepaid');
    return `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;border:1px solid #eee;text-align:left;">Product</th>
          <th style="padding:8px;border:1px solid #eee;">Qty</th>
          <th style="padding:8px;border:1px solid #eee;">Unit Price</th>
          <th style="padding:8px;border:1px solid #eee;">Total</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
      <tfoot>
        <tr><td colspan="3" style="padding:8px;border:1px solid #eee;text-align:right;">Subtotal</td><td style="padding:8px;border:1px solid #eee;">₹${subtotal.toFixed(2)}</td></tr>
        <tr><td colspan="3" style="padding:8px;border:1px solid #eee;text-align:right;">Tax</td><td style="padding:8px;border:1px solid #eee;">₹${tax.toFixed(2)}</td></tr>
        <tr><td colspan="3" style="padding:8px;border:1px solid #eee;text-align:right;">Shipping</td><td style="padding:8px;border:1px solid #eee;">₹${shipping.toFixed(2)}</td></tr>
        <tr style="font-weight:bold;"><td colspan="3" style="padding:8px;border:1px solid #eee;text-align:right;">Total</td><td style="padding:8px;border:1px solid #eee;">₹${total.toFixed(2)}</td></tr>
      </tfoot>
    </table>
    <p><strong>Payment method:</strong> ${paymentLabel}</p>
    <p><strong>Delivery address:</strong></p>
    <p>${formatAddress(order.shippingAddress)}</p>
    <p><strong>Estimated delivery:</strong> 5–7 business days</p>
  `;
}

function buildOrderConfirmationHtml(order) {
    const storeName = process.env.EMAIL_FROM_NAME || 'AnpaMart';
    const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const orderNum = esc(order.orderNumber);
    const items = order.items || [];
    const subtotal = decimalToNum(order.subtotal);
    const tax = decimalToNum(order.taxAmount);
    const shipping = decimalToNum(order.shippingAmount);
    const total = decimalToNum(order.total);
    const paymentLabel = (order.paymentMethod || '').toLowerCase() === 'cod' ? 'Cash on Delivery (COD)' : (order.paymentMethod || 'Prepaid');
    const itemRows = items.map((it) => {
        const name = esc(it.productName || '');
        const qty = it.quantity;
        const unit = decimalToNum(it.unitPrice);
        const rowTotal = decimalToNum(it.totalPrice);
        return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;text-align:center;">${qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:right;">₹${unit.toFixed(2)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#374151;text-align:right;">₹${rowTotal.toFixed(2)}</td>
      </tr>`;
    }).join('');
    const shippingAddr = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : null;
    const addressLine = shippingAddr
        ? [shippingAddr.fullName, shippingAddr.addressLine1, shippingAddr.city, shippingAddr.state, shippingAddr.pincode || shippingAddr.postalCode].filter(Boolean).join(', ')
        : '';
    const orderDetailsBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:14px 20px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Order details</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Product</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Qty</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Unit price</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 20px;background:#fafafa;border-top:1px solid #e5e7eb;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#374151;">
            <tr><td style="padding:4px 0;">Subtotal</td><td style="padding:4px 0;text-align:right;">₹${subtotal.toFixed(2)}</td></tr>
            <tr><td style="padding:4px 0;">Tax</td><td style="padding:4px 0;text-align:right;">₹${tax.toFixed(2)}</td></tr>
            <tr><td style="padding:4px 0;">Shipping</td><td style="padding:4px 0;text-align:right;">${shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`}</td></tr>
            <tr style="font-weight:700;font-size:15px;"><td style="padding:8px 0 4px 0;">Total</td><td style="padding:8px 0 4px 0;text-align:right;">₹${total.toFixed(2)}</td></tr>
          </table>
          <p style="margin:12px 0 0 0;font-size:13px;color:#6b7280;"><strong>Payment:</strong> ${esc(paymentLabel)}</p>
          ${addressLine ? `<p style="margin:6px 0 0 0;font-size:13px;color:#6b7280;"><strong>Delivery address:</strong> ${esc(addressLine)}</p>` : ''}
          <p style="margin:6px 0 0 0;font-size:13px;color:#6b7280;"><strong>Estimated delivery:</strong> 5–7 business days</p>
        </td>
      </tr>
    </table>`;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation – ${orderNum}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 24px;background:linear-gradient(135deg,#1f2937 0%,#374151 100%);text-align:center;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${esc(storeName)}</p>
              <p style="margin:8px 0 0 0;font-size:13px;color:#9ca3af;">Order confirmation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 8px 0;font-size:18px;font-weight:600;color:#111827;">Thank you for your order!</p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#6b7280;">We've received your order and will process it shortly. Order reference: <strong style="color:#374151;">${orderNum}</strong></p>
              ${orderDetailsBlock}
              <p style="margin:24px 0 0 0;font-size:14px;color:#6b7280;line-height:1.5;">If you have any questions, reply to this email or contact <a href="mailto:support@anpamart.com" style="color:#2563eb;text-decoration:none;">support@anpamart.com</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${esc(storeName)}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

function buildOrderStatusHtml(order, newStatus, trackingNumber = null) {
    const storeName = process.env.EMAIL_FROM_NAME || 'AnpaMart';
    const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const orderNum = esc(order.orderNumber);
    const statusLabel = {
        PENDING: 'Pending',
        CONFIRMED: 'Confirmed',
        PROCESSING: 'Processing',
        SHIPPED: 'Shipped',
        DELIVERED: 'Delivered',
        CANCELLED: 'Cancelled',
        RETURNED: 'Returned',
        REFUNDED: 'Refunded',
    }[newStatus] || newStatus;
    const statusColor = {
        PENDING: '#6b7280',
        CONFIRMED: '#2563eb',
        PROCESSING: '#7c3aed',
        SHIPPED: '#9333ea',
        DELIVERED: '#059669',
        CANCELLED: '#dc2626',
        RETURNED: '#ea580c',
        REFUNDED: '#4b5563',
    }[newStatus] || '#374151';
    const messages = {
        PENDING: `Your order #${orderNum} is pending.`,
        CONFIRMED: `Your order #${orderNum} has been confirmed.`,
        PROCESSING: `Your order #${orderNum} is being processed.`,
        SHIPPED: `Your order #${orderNum} has been shipped.`,
        DELIVERED: `Your order #${orderNum} has been successfully delivered.`,
        CANCELLED: `Your order #${orderNum} has been cancelled.`,
        RETURNED: `Your order #${orderNum} has been returned.`,
        REFUNDED: `Your order #${orderNum} has been refunded.`,
    };
    const message = messages[newStatus] || `Your order #${orderNum} status is now: ${esc(newStatus)}.`;

    const trackingBlock = trackingNumber
        ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 4px 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#0369a1;">Tracking number</p>
          <p style="margin:0;font-size:16px;font-weight:600;font-family:ui-monospace,monospace;color:#0c4a6e;">${esc(trackingNumber)}</p>
        </td>
      </tr>
    </table>`
        : '';

    const items = order.items || [];
    const subtotal = decimalToNum(order.subtotal);
    const tax = decimalToNum(order.taxAmount);
    const shipping = decimalToNum(order.shippingAmount);
    const total = decimalToNum(order.total);
    const paymentLabel = (order.paymentMethod || '').toLowerCase() === 'cod' ? 'Cash on Delivery (COD)' : (order.paymentMethod || 'Prepaid');
    const itemRows = items.map((it) => {
        const name = esc(it.productName || '');
        const qty = it.quantity;
        const unit = decimalToNum(it.unitPrice);
        const rowTotal = decimalToNum(it.totalPrice);
        return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;text-align:center;">${qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:right;">₹${unit.toFixed(2)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#374151;text-align:right;">₹${rowTotal.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const shippingAddr = order.shippingAddress && typeof order.shippingAddress === 'object'
        ? order.shippingAddress
        : null;
    const addressLine = shippingAddr
        ? [shippingAddr.fullName, shippingAddr.addressLine1, shippingAddr.city, shippingAddr.state, shippingAddr.pincode || shippingAddr.postalCode].filter(Boolean).join(', ')
        : '';

    const orderDetailsBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:14px 20px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Order details</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Product</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Qty</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Unit price</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 20px;background:#fafafa;border-top:1px solid #e5e7eb;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#374151;">
            <tr><td style="padding:4px 0;">Subtotal</td><td style="padding:4px 0;text-align:right;">₹${subtotal.toFixed(2)}</td></tr>
            <tr><td style="padding:4px 0;">Tax</td><td style="padding:4px 0;text-align:right;">₹${tax.toFixed(2)}</td></tr>
            <tr><td style="padding:4px 0;">Shipping</td><td style="padding:4px 0;text-align:right;">${shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`}</td></tr>
            <tr style="font-weight:700;font-size:15px;"><td style="padding:8px 0 4px 0;">Total</td><td style="padding:8px 0 4px 0;text-align:right;">₹${total.toFixed(2)}</td></tr>
          </table>
          <p style="margin:12px 0 0 0;font-size:13px;color:#6b7280;"><strong>Payment:</strong> ${esc(paymentLabel)}</p>
          ${addressLine ? `<p style="margin:6px 0 0 0;font-size:13px;color:#6b7280;"><strong>Delivery address:</strong> ${esc(addressLine)}</p>` : ''}
        </td>
      </tr>
    </table>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order ${orderNum} – ${statusLabel}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 24px;background:linear-gradient(135deg,#1f2937 0%,#374151 100%);text-align:center;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${esc(storeName)}</p>
              <p style="margin:8px 0 0 0;font-size:13px;color:#9ca3af;">Order update</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;font-weight:500;">Order ${orderNum}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:8px 14px;background:${statusColor};color:#ffffff;font-size:14px;font-weight:600;border-radius:9999px;">${esc(statusLabel)}</td>
                </tr>
              </table>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#374151;">${message}</p>
              ${trackingBlock}
              ${orderDetailsBlock}
              <p style="margin:24px 0 0 0;font-size:14px;color:#6b7280;line-height:1.5;">Thank you for shopping with us. If you have any questions, reply to this email or contact <a href="mailto:support@anpamart.com" style="color:#2563eb;text-decoration:none;">support@anpamart.com</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${esc(storeName)}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

async function logEmail(emailType, recipient, status, error = null) {
    try {
        await prisma.emailLog.create({
            data: { emailType, recipient, status, error: error ? String(error).slice(0, 2000) : null },
        });
    } catch (e) {
        logger.error('EmailLog create failed', e);
    }
}

function runAsync(fn) {
    setImmediate(() => {
        fn().catch(err => logger.error('Order email job error', err));
    });
}

/**
 * Send order confirmation to user. Non-blocking; logs to EmailLog.
 */
function sendOrderConfirmationToUser(order) {
    const to = order.user?.email;
    if (!to) return;
    runAsync(async () => {
        try {
            const html = buildOrderConfirmationHtml(order);
            await sendHtmlEmail({
                to,
                subject: `Order Confirmation - ${order.orderNumber}`,
                htmlContent: html,
            });
            await logEmail('order_confirmation', to, 'sent');
        } catch (err) {
            logger.error('Order confirmation email failed', { to, orderId: order.id, err: err.message });
            await logEmail('order_confirmation', to, 'failed', err.message);
        }
    });
}

/**
 * Send same order details to admin emails. Parallel, non-blocking. Failures do not throw.
 */
function sendOrderConfirmationToAdmins(order) {
    const html = buildOrderConfirmationHtml(order);
    const subject = `[Admin] New Order ${order.orderNumber}`;
    ADMIN_EMAILS.forEach(to => {
        runAsync(async () => {
            try {
                await sendHtmlEmail({ to, subject, htmlContent: html });
                await logEmail('admin_order_alert', to, 'sent');
            } catch (err) {
                logger.error('Admin order email failed', { to, orderId: order.id, err: err.message });
                await logEmail('admin_order_alert', to, 'failed', err.message);
            }
        });
    });
}

/**
 * Trigger after order is successfully placed: user + admin emails (async).
 */
function onOrderPlaced(orderWithUserAndItems) {
    sendOrderConfirmationToUser(orderWithUserAndItems);
    sendOrderConfirmationToAdmins(orderWithUserAndItems);
}

/**
 * Send order status change email to user. Call only when status actually changed.
 * Also creates an in-app Notification for the user so they see the update in their dashboard.
 */
function sendOrderStatusChangeToUser(order, newStatus, trackingNumber = null) {
    const to = order.user?.email;
    const userId = order.userId || order.user?.id;

    const messages = {
        PENDING: `Your order #${order.orderNumber} is pending.`,
        CONFIRMED: `Your order #${order.orderNumber} has been confirmed.`,
        PROCESSING: `Your order #${order.orderNumber} is being processed.`,
        SHIPPED: `Your order #${order.orderNumber} has been shipped.`,
        DELIVERED: `Your order #${order.orderNumber} has been successfully delivered.`,
        CANCELLED: `Your order #${order.orderNumber} has been cancelled.`,
        RETURNED: `Your order #${order.orderNumber} has been returned.`,
        REFUNDED: `Your order #${order.orderNumber} has been refunded.`,
    };
    const message = messages[newStatus] || `Your order #${order.orderNumber} status is now: ${newStatus}.`;

    if (userId) {
        runAsync(async () => {
            try {
                await prisma.notification.create({
                    data: {
                        userId,
                        type: 'ORDER',
                        title: `Order ${order.orderNumber} - ${newStatus}`,
                        message: trackingNumber ? `${message} Tracking: ${trackingNumber}` : message,
                        link: `/account/orders`,
                    },
                });
            } catch (e) {
                logger.error('Order status notification create failed', { userId, orderId: order.id, e: e.message });
            }
        });
    }

    if (!to) return;
    runAsync(async () => {
        try {
            const html = buildOrderStatusHtml(order, newStatus, trackingNumber);
            await sendHtmlEmail({
                to,
                subject: `Order ${order.orderNumber} - ${newStatus}`,
                htmlContent: html,
            });
            await logEmail('order_status', to, 'sent');
        } catch (err) {
            logger.error('Order status email failed', { to, orderId: order.id, err: err.message });
            await logEmail('order_status', to, 'failed', err.message);
        }
    });
}

module.exports = {
    onOrderPlaced,
    sendOrderConfirmationToUser,
    sendOrderConfirmationToAdmins,
    sendOrderStatusChangeToUser,
    buildOrderConfirmationHtml,
    buildOrderStatusHtml,
    ADMIN_EMAILS,
};
