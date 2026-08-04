const { prisma } = require('../../../config/database');
const logger   = require('../../../utils/logger');
const { generateAirpayQr, airpayDecrypt } = require('./airpay.service');
const { enqueueForward } = require('../../../queues');

// Generates a unique internal orderid for AirPay (≤30 alphanumeric chars)
function generateAirpayOrderId() {
  return `AP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    .slice(0, 30)
    .toUpperCase();
}

// ─── 1. Initiate payin — AccuzPay calls this ─────────────────────────────────

exports.initiateAirpayPayin = async (req, res, next) => {
  try {
    const { reference_id, amount, name, email, phone, customerId } = req.body;

    const callback_url = process.env.ACCUZPAY_CALLBACK_URL;
    if (!callback_url) {
      logger.error('[AIRPAY-ACCUZPAY] ACCUZPAY_CALLBACK_URL not set');
      return res.status(500).json({ success: false, message: 'Payment gateway misconfigured — callback URL missing' });
    }

    if (!reference_id || !amount || !email || !customerId) {
      return res.status(400).json({ success: false, message: 'Missing required fields: reference_id, amount, email, customerId' });
    }

    const existing = await prisma.airpayPayment.findUnique({ where: { referenceId: reference_id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Transaction with this reference_id already exists' });
    }

    const airpayOrderId = generateAirpayOrderId();
    const cleanPhone    = phone?.replace(/\D/g, '').slice(-10) || '';

    const { upiIntentUri, apTransactionId, raw } = await generateAirpayQr({
      airpayOrderId,
      amount,
      buyerEmail: email,
      buyerPhone: cleanPhone || '9999999999',
    });

    await prisma.airpayPayment.create({
      data: {
        referenceId:     reference_id,
        airpayOrderId,
        apTransactionId,
        upiIntentUri,
        customerId,
        amount:          parseFloat(amount),
        status:          'PENDING',
        callbackUrl:     callback_url,
        customerName:    name        || null,
        customerEmail:   email,
        customerPhone:   cleanPhone  || null,
        airpayRaw:       raw,
      },
    });

    logger.info({ reference_id, airpayOrderId, apTransactionId }, '[AIRPAY-ACCUZPAY] payin initiated');
    return res.status(200).json({
      success:           true,
      reference_id,
      airpay_order_id:   airpayOrderId,
      ap_transaction_id: apTransactionId,
      upi_intent_uri:    upiIntentUri,  // AccuzPay renders QR from this and uses it for deep linking
    });
  } catch (error) {
    logger.error(`[AIRPAY-ACCUZPAY] initiatePayin error: ${error.message}`);
    next(error);
  }
};

// ─── 2. AirPay IPN callback — AirPay notifies us on payment completion ────────
// AirPay POSTs an encrypted `response` field (or plain fields) to this URL.
// We trust the IPN payload (no server-side verify call) and queue the forward.

exports.handleAirpayIpn = async (req, res) => {
  try {
    const body = req.body;
    logger.debug({ body }, '[AIRPAY] IPN received');

    // Decrypt the IPN response once — it carries orderid, status and utr.
    let orderid   = body.orderid || body.order_id || null;
    let decrypted = null;
    if (body.response) {
      try {
        decrypted = JSON.parse(airpayDecrypt(body.response, process.env.AIRPAY_SECRET_KEY));
        orderid   = orderid || decrypted?.data?.orderid || decrypted?.orderid || null;
        logger.debug({ decrypted }, '[AIRPAY] IPN response decrypted');
      } catch (decryptErr) {
        logger.warn(`[AIRPAY] IPN: could not decrypt response — ${decryptErr.message}`);
      }
    }

    if (!orderid) {
      logger.warn('[AIRPAY] IPN: could not extract orderid — ignoring');
      return res.status(200).json({ received: true });
    }

    const payment = await prisma.airpayPayment.findUnique({ where: { airpayOrderId: orderid } });
    if (!payment) {
      logger.warn(`[AIRPAY] IPN: no AirpayPayment found for airpayOrderId=${orderid}`);
      return res.status(200).json({ received: true });
    }

    if (payment.status === 'FORWARDED') {
      logger.info(`[AIRPAY] IPN: already forwarded — referenceId=${payment.referenceId}`);
      return res.status(200).json({ received: true });
    }

    // Trust the IPN payload — read status/utr straight from it.
    const src       = decrypted?.data || decrypted || body;
    const txnStatus = String(src.transaction_payment_status || body.transaction_payment_status || 'UNKNOWN').toUpperCase();
    const utr       = src.rrn || src.utr || src.bank_ref_no || null;
    const apTransactionId = src.ap_transactionid || payment.apTransactionId || null;

    logger.info({ orderid, txnStatus }, '[AIRPAY] IPN: trusting payload status');

    const dbStatus = txnStatus === 'SUCCESS' ? 'SUCCESS' : txnStatus === 'FAILED' ? 'FAILED' : 'PENDING';
    await prisma.airpayPayment.update({
      where: { id: payment.id },
      data:  { status: dbStatus, utr, airpayRaw: decrypted || body },
    });

    if (txnStatus !== 'SUCCESS') {
      logger.info(`[AIRPAY] IPN: status=${txnStatus} — not forwarding`);
      return res.status(200).json({ received: true });
    }

    await enqueueForward({
      gateway:         'airpay',
      paymentId:       payment.id,
      referenceId:     payment.referenceId,
      callbackUrl:     payment.callbackUrl,
      amount:          parseFloat(payment.amount),
      status:          'TXN',
      utr,
      apTransactionId,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`[AIRPAY] IPN error: ${error.message}`);
    return res.status(200).json({ received: true }); // always 200 to AirPay
  }
};

// ─── 3. Status check — AccuzPay polls this ───────────────────────────────────

exports.checkAirpayTransaction = async (req, res, next) => {
  try {
    const reference_id = req.query.reference_id || req.body.reference_id;
    if (!reference_id) {
      return res.status(400).json({ success: false, message: 'reference_id is required' });
    }

    const payment = await prisma.airpayPayment.findUnique({ where: { referenceId: reference_id } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Return DB state — kept current by the (trusted) IPN. No live gateway call.
    const dbStatus    = payment.status;
    const accuzStatus = (dbStatus === 'SUCCESS' || dbStatus === 'FORWARDED') ? 'TXN' : dbStatus;
    const utr         = (dbStatus === 'SUCCESS' || dbStatus === 'FORWARDED') ? payment.utr : null;

    return res.status(200).json({
      success:           true,
      reference_id:      payment.referenceId,
      status:            accuzStatus,
      airpay_status:     dbStatus,
      airpay_order_id:   payment.airpayOrderId,
      ap_transaction_id: payment.apTransactionId,
      forwarded:         dbStatus === 'FORWARDED',
      amount:            parseFloat(payment.amount),
      utr,
    });
  } catch (error) {
    logger.error(`[AIRPAY-ACCUZPAY] checkTransaction error: ${error.message}`);
    next(error);
  }
};

// ─── 4. Admin — list transactions ─────────────────────────────────────────────

exports.listAirpayTransactions = async (req, res, next) => {
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
      prisma.airpayPayment.count({ where }),
      prisma.airpayPayment.findMany({
        where,
        skip,
        take:    parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, referenceId: true, airpayOrderId: true, apTransactionId: true,
          amount: true, status: true, customerName: true, customerEmail: true,
          customerPhone: true, upiIntentUri: true, forwardedAt: true, createdAt: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      data: transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error(`[AIRPAY-ACCUZPAY] listTransactions error: ${error.message}`);
    next(error);
  }
};

// ─── 5. Admin — single transaction ───────────────────────────────────────────

exports.getAirpayTransaction = async (req, res, next) => {
  try {
    const payment = await prisma.airpayPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.json({ success: true, data: payment });
  } catch (error) {
    logger.error(`[AIRPAY-ACCUZPAY] getTransaction error: ${error.message}`);
    next(error);
  }
};
