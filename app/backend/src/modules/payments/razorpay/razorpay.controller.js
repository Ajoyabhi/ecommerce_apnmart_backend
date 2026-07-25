const axios    = require('axios');
const { prisma } = require('../../../config/database');
const logger   = require('../../../utils/logger');
const {
  createRazorpayOrder,
  initiateRazorpayUpiIntent,
  fetchRazorpayOrder,
  fetchOrderPayments,
  fetchRazorpayPayment,
  verifyRazorpayWebhookSignature,
} = require('./razorpay.service');

function generateRazorpayReceiptId() {
  return `RP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    .slice(0, 40)
    .toUpperCase();
}

// ─── Forward result to AccuzPay ──────────────────────────────────────────────
async function forwardToAccuzpay(payment, { paymentId, utr, status, errorCode, errorMessage }) {
  const body = {
    reference_id: payment.referenceId,
    status,
    utr:          utr || null,
    amount:       parseFloat(payment.amount),
    payment_id:   paymentId || null,
    ...(errorCode    && { error_code:    errorCode }),
    ...(errorMessage && { error_message: errorMessage }),
  };

  await axios.post(
    payment.callbackUrl,
    body,
    {
      headers: { 'x-api-key': process.env.ACCUZPAY_SHARED_SECRET, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );

  await prisma.razorpayPayment.update({
    where: { id: payment.id },
    data:  { status: 'FORWARDED', forwardedAt: new Date() },
  });

  logger.info({ referenceId: payment.referenceId, status, utr }, '[RAZORPAY] forwarded to AccuzPay OK');
}

// ─── 1. Initiate payin ────────────────────────────────────────────────────────
exports.initiateRazorpayPayin = async (req, res, next) => {
  try {
    const { reference_id, amount, name, email, phone, customerId } = req.body;

    const callback_url = process.env.ACCUZPAY_CALLBACK_URL;
    if (!callback_url) {
      return res.status(500).json({ success: false, message: 'Payment gateway misconfigured — callback URL missing' });
    }

    if (!reference_id || !amount || !email || !customerId) {
      return res.status(400).json({ success: false, message: 'Missing required fields: reference_id, amount, email, customerId' });
    }

    const existing = await prisma.razorpayPayment.findUnique({ where: { referenceId: reference_id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Transaction with this reference_id already exists' });
    }

    const cleanPhone = phone ? `+91${phone.replace(/\D/g, '').slice(-10)}` : '+919999999999';

    // Step 1 — create order
    const receiptId = generateRazorpayReceiptId();
    const order = await createRazorpayOrder({
      amount,
      receipt: receiptId,

    });

    // Step 2 — initiate S2S UPI Intent
    const intent = await initiateRazorpayUpiIntent({
      amount,
      razorpayOrderId: order.id,
      contact:         cleanPhone,
      callbackUrl:     process.env.RAZORPAY_CALLBACK_URL,
      email,
    });

    const upiIntentUri    = intent.link;
    const razorpayPaymentId = intent.razorpay_payment_id;

    if (!upiIntentUri) {
      logger.error({ intent }, '[RAZORPAY] No UPI link in intent response');
      return res.status(502).json({ success: false, message: 'UPI intent link missing in Razorpay response' });
    }

    logger.info({ reference_id, orderId: order.id, razorpayPaymentId, upiIntentUri }, '[RAZORPAY] UPI Intent created');

    await prisma.razorpayPayment.create({
      data: {
        referenceId:      reference_id,
        razorpayOrderId:  order.id,
        razorpayPaymentId,
        upiIntentUri,
        customerId,
        amount:           parseFloat(amount),
        status:           'PENDING',
        callbackUrl:      callback_url,
        customerName:     name  || null,
        customerEmail:    email,
        customerPhone:    phone || null,
      },
    });

    return res.status(200).json({
      success:            true,
      reference_id,
      razorpay_order_id:  order.id,
      razorpay_payment_id: razorpayPaymentId,
      upi_intent_uri:     upiIntentUri,
      expires_at:         Math.floor(Date.now() / 1000) + 15 * 60,
    });
  } catch (error) {
    logger.error(`[RAZORPAY] initiatePayin error: ${error.message}`);
    if (error.razorpayError) {
      return res.status(502).json({ success: false, message: error.message, razorpay_error: error.razorpayError });
    }
    next(error);
  }
};

// ─── 2. Webhook ───────────────────────────────────────────────────────────────
exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const rawBody   = req.body;
    const signature = req.headers['x-razorpay-signature'];

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      logger.warn('[RAZORPAY] webhook: invalid signature — rejected');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody.toString());
    const event   = payload.event;
    logger.info({ event }, '[RAZORPAY] webhook received');

    if (event === 'payment.captured') {
      return handlePaymentCaptured(payload, res);
    }

    if (event === 'payment.failed') {
      return handlePaymentFailed(payload, res);
    }

    logger.info(`[RAZORPAY] webhook: ignoring event ${event}`);
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`[RAZORPAY] webhook error: ${error.message}`);
    return res.status(200).json({ received: true });
  }
};

async function handlePaymentCaptured(payload, res) {
  const paymentEntity = payload?.payload?.payment?.entity;
  const paymentId     = paymentEntity?.id;
  const orderId       = paymentEntity?.order_id;

  if (!orderId) {
    logger.warn('[RAZORPAY] payment.captured: missing order_id');
    return res.status(200).json({ received: true });
  }

  const payment = await prisma.razorpayPayment.findUnique({ where: { razorpayOrderId: orderId } });
  if (!payment) {
    logger.warn(`[RAZORPAY] payment.captured: no record for orderId=${orderId}`);
    return res.status(200).json({ received: true });
  }

  if (payment.status === 'FORWARDED') {
    logger.info(`[RAZORPAY] payment.captured: already forwarded — referenceId=${payment.referenceId}`);
    return res.status(200).json({ received: true });
  }

  await prisma.razorpayPayment.update({
    where: { id: payment.id },
    data:  { razorpayPaymentId: paymentId, status: 'CAPTURED' },
  });

  const utr = paymentEntity?.acquirer_data?.rrn
           || paymentEntity?.acquirer_data?.utr
           || null;

  logger.info({ referenceId: payment.referenceId, utr, paymentId }, '[RAZORPAY] forwarding to AccuzPay');

  try {
    await forwardToAccuzpay(payment, { paymentId, utr, status: 'TXN' });
  } catch (fwdErr) {
    logger.error(`[RAZORPAY] forward to AccuzPay failed — ${fwdErr.message} — will retry on next webhook`);
  }

  return res.status(200).json({ received: true });
}

async function handlePaymentFailed(payload, res) {
  const paymentEntity = payload?.payload?.payment?.entity;
  const paymentId     = paymentEntity?.id;
  const orderId       = paymentEntity?.order_id;
  const errorCode     = paymentEntity?.error_code    || null;
  const errorMessage  = paymentEntity?.error_description || null;

  if (!orderId) return res.status(200).json({ received: true });

  const payment = await prisma.razorpayPayment.findUnique({ where: { razorpayOrderId: orderId } });
  if (!payment) return res.status(200).json({ received: true });

  if (payment.status === 'FORWARDED') return res.status(200).json({ received: true });

  await prisma.razorpayPayment.update({
    where: { id: payment.id },
    data:  { razorpayPaymentId: paymentId || null, status: 'FAILED' },
  });

  logger.info(`[RAZORPAY] payment.failed — referenceId=${payment.referenceId} error=${errorCode}`);

  try {
    await forwardToAccuzpay(payment, { paymentId, utr: null, status: 'FAILED', errorCode, errorMessage });
  } catch (fwdErr) {
    logger.error(`[RAZORPAY] forward failed payment to AccuzPay failed — ${fwdErr.message}`);
  }

  return res.status(200).json({ received: true });
}

// ─── 3. Status check ──────────────────────────────────────────────────────────
exports.checkRazorpayTransaction = async (req, res, next) => {
  try {
    const reference_id = req.query.reference_id || req.body.reference_id;
    if (!reference_id) {
      return res.status(400).json({ success: false, message: 'reference_id is required' });
    }

    const payment = await prisma.razorpayPayment.findUnique({ where: { referenceId: reference_id } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    let liveStatus    = payment.status;
    let utr           = null;
    let razorpayPaymentId = payment.razorpayPaymentId;

    // If still pending, poll Razorpay order for live status
    if (payment.status === 'PENDING' && payment.razorpayOrderId) {
      try {
        const orderPayments = await fetchOrderPayments(payment.razorpayOrderId);
        const captured = orderPayments?.items?.find(p => p.status === 'captured');
        const failed   = orderPayments?.items?.find(p => p.status === 'failed');

        if (captured) {
          liveStatus        = 'CAPTURED';
          razorpayPaymentId = captured.id;
          utr               = captured.acquirer_data?.rrn || captured.acquirer_data?.utr || null;

          await prisma.razorpayPayment.update({
            where: { id: payment.id },
            data:  { status: 'CAPTURED', razorpayPaymentId: captured.id },
          });
        } else if (failed) {
          liveStatus        = 'FAILED';
          razorpayPaymentId = failed.id;

          await prisma.razorpayPayment.update({
            where: { id: payment.id },
            data:  { status: 'FAILED', razorpayPaymentId: failed.id },
          });
        }
      } catch (err) {
        logger.warn(`[RAZORPAY] checkTransaction: order payments poll failed — ${err.message}`);
      }
    }

    // If captured/forwarded and no UTR yet, fetch from payment
    if ((liveStatus === 'CAPTURED' || liveStatus === 'FORWARDED') && !utr && razorpayPaymentId) {
      try {
        const livePayment = await fetchRazorpayPayment(razorpayPaymentId);
        utr = livePayment?.acquirer_data?.rrn || livePayment?.acquirer_data?.utr || null;
      } catch (err) {
        logger.warn(`[RAZORPAY] checkTransaction: payment fetch failed — ${err.message}`);
      }
    }

    const accuzpayStatus = (liveStatus === 'CAPTURED' || liveStatus === 'FORWARDED') ? 'TXN' : liveStatus;

    return res.status(200).json({
      success:              true,
      reference_id:         payment.referenceId,
      status:               accuzpayStatus,
      razorpay_status:      liveStatus,
      razorpay_order_id:    payment.razorpayOrderId,
      razorpay_payment_id:  razorpayPaymentId,
      upi_intent_uri:       payment.upiIntentUri,
      forwarded:            payment.status === 'FORWARDED',
      amount:               parseFloat(payment.amount),
      utr,
    });
  } catch (error) {
    logger.error(`[RAZORPAY] checkTransaction error: ${error.message}`);
    next(error);
  }
};

// ─── 4. Admin — list transactions ─────────────────────────────────────────────
exports.listRazorpayTransactions = async (req, res, next) => {
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
        { referenceId:   { contains: search, mode: 'insensitive' } },
        { customerName:  { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, transactions] = await Promise.all([
      prisma.razorpayPayment.count({ where }),
      prisma.razorpayPayment.findMany({
        where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' },
        select: {
          id: true, referenceId: true, razorpayOrderId: true,
          razorpayPaymentId: true, upiIntentUri: true,
          amount: true, status: true,
          customerName: true, customerEmail: true, customerPhone: true,
          forwardedAt: true, createdAt: true,
        },
      }),
    ]);

    return res.json({
      success: true, data: transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error(`[RAZORPAY] listTransactions error: ${error.message}`);
    next(error);
  }
};

// ─── 5. Admin — single transaction ───────────────────────────────────────────
exports.getRazorpayTransaction = async (req, res, next) => {
  try {
    const payment = await prisma.razorpayPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.json({ success: true, data: payment });
  } catch (error) {
    logger.error(`[RAZORPAY] getTransaction error: ${error.message}`);
    next(error);
  }
};
