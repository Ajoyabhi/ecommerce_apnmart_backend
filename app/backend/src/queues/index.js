const { Queue } = require('bullmq');
const { connection } = require('./connection');
const logger = require('../utils/logger');

// ─── Queue names (shared by producers here and workers in worker.js) ──────────
const QUEUE_NAMES = {
  FORWARD: 'payment-forward',
  INVOICE: 'invoice',
};

// ─── Producers ────────────────────────────────────────────────────────────────
// These are instantiated in the web process. Workers live in worker.js.

const forwardQueue = new Queue(QUEUE_NAMES.FORWARD, {
  connection,
  defaultJobOptions: {
    attempts: 6,
    backoff: { type: 'exponential', delay: 3000 }, // 3s, 6s, 12s, 24s, 48s...
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

const invoiceQueue = new Queue(QUEUE_NAMES.INVOICE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 500,
  },
});

/**
 * Enqueue a forward-to-AccuzPay job. Trusts the status/utr already derived from
 * the (trusted) webhook payload — the worker just does the downstream POST +
 * marks the row FORWARDED, with automatic retry/backoff.
 *
 * jobId = `${gateway}__${referenceId}` so duplicate webhooks for the same txn
 * collapse to a single in-flight job (idempotent enqueue). Note: BullMQ reserves
 * ':' as its key separator, so custom job ids must not contain it.
 */
async function enqueueForward(data) {
  try {
    return await forwardQueue.add('forward', data, {
      jobId: `${data.gateway}__${data.referenceId}`,
    });
  } catch (err) {
    // Never let a queue hiccup break the webhook 200 response.
    logger.error(`[QUEUE] enqueueForward failed for ${data.gateway}:${data.referenceId} — ${err.message}`);
    return null;
  }
}

/**
 * Enqueue invoice PDF generation (CPU-heavy Chromium render) off the request path.
 */
async function enqueueInvoice(data) {
  try {
    return await invoiceQueue.add('invoice', data, {
      jobId: `invoice__${data.paymentId}`,
    });
  } catch (err) {
    logger.error(`[QUEUE] enqueueInvoice failed for ${data.paymentId} — ${err.message}`);
    return null;
  }
}

module.exports = {
  QUEUE_NAMES,
  forwardQueue,
  invoiceQueue,
  enqueueForward,
  enqueueInvoice,
};
