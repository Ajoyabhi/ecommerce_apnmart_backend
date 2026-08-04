const logger = require('../../utils/logger');
const { ensureInvoice } = require('../../modules/payments/hdfc/accuzpay.invoice');

/**
 * Generate + persist the invoice PDF for an AccuzPay transaction off the request
 * path. Idempotent — ensureInvoice() serves the cached file if already rendered.
 *
 * job.data = { paymentId }
 */
async function processInvoice(job) {
  const { paymentId } = job.data;
  const filePath = await ensureInvoice(paymentId);
  logger.info(`[INVOICE] generated for payment ${paymentId} → ${filePath}`);
}

module.exports = { processInvoice };
