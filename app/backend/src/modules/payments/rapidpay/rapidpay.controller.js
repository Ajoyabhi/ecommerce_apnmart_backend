const { prisma } = require('../../../config/database');
const logger   = require('../../../utils/logger');
const {
  initiateCollection,
  checkCollectionStatus,
  getCollectionBalance,
} = require('./rapidpay.service');
const { enqueueForward } = require('../../../queues');

// Our id sent to RapidPay as `reference_id` (kept separate from AccuzPay's id,
// same as AirPay's orderid / Razorpay's receipt).
function generateRapidpayOrderId() {
  return `RPC${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    .slice(0, 30)
    .toUpperCase();
}

function forwardCollection(payment, status, { utr, providerTxnId, errorMessage } = {}) {
  return enqueueForward({
    gateway:           'rapidpay',
    paymentId:         payment.id,
    referenceId:       payment.referenceId,
    callbackUrl:       payment.callbackUrl,
    amount:            parseFloat(payment.amount),
    status:            status === 'SUCCESS' ? 'TXN' : 'FAILED',
    utr:               status === 'SUCCESS' ? (utr || null) : null,
    paymentIdExternal: providerTxnId || null,
    ...(status === 'FAILED' && errorMessage && { errorMessage }),
  });
}

// Verify live with RapidPay, sync the row, forward terminal outcomes once.
// Returns the refreshed row.
async function syncCollection(payment) {
  const live = await checkCollectionStatus(payment.rapidpayOrderId);

  // Never downgrade a terminal row back to PENDING on an ambiguous live answer.
  const isTerminal    = payment.status === 'SUCCESS' || payment.status === 'FAILED';
  const status        = (isTerminal && live.status === 'PENDING') ? payment.status : live.status;
  const utr           = live.utr || payment.utr;
  const providerTxnId = live.providerTxnId || payment.providerTxnId;

  const updated = await prisma.rapidpayPayment.update({
    where: { id: payment.id },
    data:  {
      status,
      utr:           utr || null,
      providerTxnId: providerTxnId || null,
      failureReason: status === 'FAILED' ? (live.message || live.rawStatus || 'Payment failed') : null,
      rapidpayRaw:   live.raw,
    },
  });

  if (!payment.forwardedAt && (status === 'SUCCESS' || status === 'FAILED')) {
    await forwardCollection(updated, status, { utr, providerTxnId, errorMessage: updated.failureReason });
  }
  return updated;
}

// ─── 1. Initiate collection — AccuzPay calls this ────────────────────────────

exports.initiateRapidpayPayin = async (req, res, next) => {
  try {
    const { reference_id, amount, name, email, phone, customerId } = req.body;

    const callback_url = process.env.ACCUZPAY_CALLBACK_URL;
    if (!callback_url) {
      logger.error('[RAPIDPAY-ACCUZPAY] ACCUZPAY_CALLBACK_URL not set');
      return res.status(500).json({ success: false, message: 'Payment gateway misconfigured — callback URL missing' });
    }

    if (!reference_id || !amount || !email || !customerId) {
      return res.status(400).json({ success: false, message: 'Missing required fields: reference_id, amount, email, customerId' });
    }

    const existing = await prisma.rapidpayPayment.findUnique({ where: { referenceId: reference_id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Transaction with this reference_id already exists' });
    }

    const rapidpayOrderId = generateRapidpayOrderId();
    const cleanPhone      = phone?.replace(/\D/g, '').slice(-10) || '';

    // Persist first so a webhook racing the response still finds the row.
    const payment = await prisma.rapidpayPayment.create({
      data: {
        referenceId:   reference_id,
        rapidpayOrderId,
        customerId,
        amount:        parseFloat(amount),
        status:        'PENDING',
        callbackUrl:   callback_url,
        customerName:  name       || null,
        customerEmail: email,
        customerPhone: cleanPhone || null,
      },
    });

    let result;
    try {
      result = await initiateCollection({
        referenceId: rapidpayOrderId,
        amount,
        name:        name || 'Customer',
        email,
        phone:       cleanPhone || '9999999999',
      });
    } catch (err) {
      await prisma.rapidpayPayment.update({
        where: { id: payment.id },
        data:  { status: 'FAILED', failureReason: err.message, rapidpayRaw: err.providerError || null },
      });
      throw err;
    }

    await prisma.rapidpayPayment.update({
      where: { id: payment.id },
      data:  { upiIntentUri: result.upiIntentUri, providerTxnId: result.providerTxnId, rapidpayRaw: result.raw },
    });

    if (!result.upiIntentUri) {
      logger.warn({ reference_id, payload: result.raw?.payload }, '[RAPIDPAY-ACCUZPAY] no UPI intent field recognised in initiate payload');
    }

    logger.info({ reference_id, rapidpayOrderId, providerTxnId: result.providerTxnId }, '[RAPIDPAY-ACCUZPAY] payin initiated');
    return res.status(200).json({
      success:           true,
      reference_id,
      rapidpay_order_id: rapidpayOrderId,
      rapidpay_txn_id:   result.providerTxnId,
      upi_intent_uri:    result.upiIntentUri,
      rapidpay_payload:  result.raw?.payload ?? null, // full provider payload (link / QR fields)
    });
  } catch (error) {
    logger.error(`[RAPIDPAY-ACCUZPAY] initiatePayin error: ${error.message}`);
    if (error.providerError) {
      return res.status(502).json({ success: false, message: error.message, provider_error: error.providerError });
    }
    next(error);
  }
};

// ─── 2. RapidPay callback — treated as a trigger only ────────────────────────
// The callback format/signing is undocumented, so we never trust its body:
// we extract the reference_id and re-verify via /collection/status.

exports.handleRapidpayWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const node = body.payload || body.data || body;
    const ref  = node.reference_id || node.referenceId || node.order_id || body.reference_id || null;
    logger.info({ ref, body }, '[RAPIDPAY] collection webhook received');

    if (!ref) {
      logger.warn('[RAPIDPAY] collection webhook: no reference_id — ignoring');
      return res.status(200).json({ received: true });
    }

    const payment = await prisma.rapidpayPayment.findFirst({
      where: { OR: [{ rapidpayOrderId: ref }, { referenceId: ref }] },
    });
    if (!payment) {
      logger.warn(`[RAPIDPAY] collection webhook: no record for ref=${ref}`);
      return res.status(200).json({ received: true });
    }
    if (payment.forwardedAt) {
      logger.info(`[RAPIDPAY] collection webhook: already forwarded — referenceId=${payment.referenceId}`);
      return res.status(200).json({ received: true });
    }

    try {
      await syncCollection(payment);
    } catch (err) {
      logger.error(`[RAPIDPAY] collection webhook: status verify failed for ${ref} — ${err.message}; not forwarding`);
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`[RAPIDPAY] collection webhook error: ${error.message}`);
    return res.status(200).json({ received: true });
  }
};

// ─── 3. Status check — AccuzPay polls this ───────────────────────────────────

exports.checkRapidpayTransaction = async (req, res, next) => {
  try {
    const reference_id = req.query.reference_id || req.body?.reference_id;
    if (!reference_id) {
      return res.status(400).json({ success: false, message: 'reference_id is required' });
    }

    let payment = await prisma.rapidpayPayment.findUnique({ where: { referenceId: reference_id } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Live pass-through with DB fallback (same as AirPay / Razorpay).
    try {
      payment = await syncCollection(payment);
    } catch (err) {
      logger.warn(`[RAPIDPAY-ACCUZPAY] checkTransaction: live status failed for ${reference_id} — ${err.message}; returning DB state`);
    }

    const isSuccess = payment.status === 'SUCCESS';
    const responseBody = {
      success:           true,
      reference_id:      payment.referenceId,
      status:            isSuccess ? 'TXN' : payment.status,   // TXN | FAILED | PENDING
      rapidpay_status:   payment.status,
      rapidpay_order_id: payment.rapidpayOrderId,
      rapidpay_txn_id:   payment.providerTxnId,
      forwarded:         !!payment.forwardedAt,
      amount:            parseFloat(payment.amount),
      utr:               isSuccess ? payment.utr : null,
      failure_reason:    payment.status === 'FAILED' ? payment.failureReason : null,
    };

    logger.info(`[RAPIDPAY-ACCUZPAY] checkTransaction <- response: ${JSON.stringify(responseBody)}`);
    return res.status(200).json(responseBody);
  } catch (error) {
    logger.error(`[RAPIDPAY-ACCUZPAY] checkTransaction error: ${error.message}`);
    next(error);
  }
};

// ─── 4. Collection wallet balance ────────────────────────────────────────────

exports.getRapidpayCollectionBalance = async (req, res, next) => {
  try {
    const { balance } = await getCollectionBalance();
    return res.json({ success: true, balance });
  } catch (error) {
    logger.error(`[RAPIDPAY] collection balance error: ${error.message}`);
    if (error.providerError) {
      return res.status(502).json({ success: false, message: error.message, provider_error: error.providerError });
    }
    next(error);
  }
};

// ─── 5. Admin — list / single ────────────────────────────────────────────────

exports.listRapidpayTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   where.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    if (search) {
      where.OR = [
        { referenceId:     { contains: search, mode: 'insensitive' } },
        { rapidpayOrderId: { contains: search, mode: 'insensitive' } },
        { customerName:    { contains: search, mode: 'insensitive' } },
        { customerEmail:   { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, transactions] = await Promise.all([
      prisma.rapidpayPayment.count({ where }),
      prisma.rapidpayPayment.findMany({
        where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' },
        select: {
          id: true, referenceId: true, rapidpayOrderId: true, providerTxnId: true,
          amount: true, status: true, utr: true, customerName: true, customerEmail: true,
          customerPhone: true, upiIntentUri: true, failureReason: true, forwardedAt: true, createdAt: true,
        },
      }),
    ]);

    return res.json({
      success: true, data: transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error(`[RAPIDPAY] listTransactions error: ${error.message}`);
    next(error);
  }
};

exports.getRapidpayTransaction = async (req, res, next) => {
  try {
    const payment = await prisma.rapidpayPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.json({ success: true, data: payment });
  } catch (error) {
    logger.error(`[RAPIDPAY] getTransaction error: ${error.message}`);
    next(error);
  }
};
