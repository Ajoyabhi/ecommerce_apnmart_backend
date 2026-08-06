const { prisma } = require('../../config/database');
const { gatewayHttp } = require('../../config/httpClient');
const logger = require('../../utils/logger');

// Maps the gateway tag to its Prisma model delegate.
const MODEL_BY_GATEWAY = {
  hdfc:     'accuzpayPayment',
  airpay:   'airpayPayment',
  razorpay: 'razorpayPayment',
  payout:   'payoutTransaction',
};

/**
 * Forward a confirmed/failed payment result to the AccuzPay callback URL.
 * Idempotent: if the row is already FORWARDED, it no-ops. On a non-2xx / network
 * error it throws, so BullMQ retries with backoff.
 *
 * job.data = {
 *   gateway, paymentId, referenceId, callbackUrl, amount,
 *   status,            // 'TXN' | 'FAILED'
 *   utr,               // nullable
 *   paymentIdExternal, // razorpay payment id (optional)
 *   apTransactionId,   // airpay txn id (optional)
 *   errorCode, errorMessage,
 * }
 */
async function processForward(job) {
  const {
    gateway, paymentId, referenceId, callbackUrl, amount,
    status, utr, paymentIdExternal, apTransactionId, errorCode, errorMessage,
  } = job.data;

  const model = MODEL_BY_GATEWAY[gateway];
  if (!model) throw new Error(`[FORWARD] unknown gateway: ${gateway}`);

  const current = await prisma[model].findUnique({ where: { id: paymentId } });
  if (!current) {
    logger.warn(`[FORWARD] ${gateway}: payment ${paymentId} not found — dropping job`);
    return; // nothing to forward; don't retry
  }
  if (current.status === 'FORWARDED') {
    logger.info(`[FORWARD] ${gateway}: referenceId=${referenceId} already forwarded — skip`);
    return;
  }

  const body = {
    reference_id: referenceId,
    status,
    utr:          utr || null,
    amount,
    ...(paymentIdExternal && { payment_id:        paymentIdExternal }),
    ...(apTransactionId   && { ap_transaction_id: apTransactionId }),
    ...(errorCode         && { error_code:        errorCode }),
    ...(errorMessage      && { error_message:     errorMessage }),
  };

  await gatewayHttp.post(callbackUrl, body, {
    headers: { 'x-api-key': process.env.ACCUZPAY_SHARED_SECRET, 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  await prisma[model].update({
    where: { id: paymentId },
    data:  { status: 'FORWARDED', forwardedAt: new Date() },
  });

  logger.info(`[FORWARD] ${gateway}: referenceId=${referenceId} status=${status} forwarded OK`);
}

module.exports = { processForward };
