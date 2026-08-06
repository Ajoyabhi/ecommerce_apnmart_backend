const { prisma } = require('../../../config/database');
const logger   = require('../../../utils/logger');
const {
  initiateMizorpayPayout,
  checkMizorpayStatus,
  getMizorpayBalance,
} = require('./payout.service');
const { enqueueForward } = require('../../../queues');

// Our internal id sent to MizorPay as `transaction_id` (≤30 chars, unique).
// MizorPay echoes it back as `txn_id` in status-check and callbacks.
function generatePayoutOrderId() {
  return `PO${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    .slice(0, 30)
    .toUpperCase();
}

// MizorPay's `bank_name` in their docs is a 4-char code equal to the IFSC prefix
// (e.g. IFSC "YESB0000338" → "YESB"). AccuzPay sends a human name ("PUNJAB BANK"),
// so we derive the code from the IFSC for the gateway call. ⚠️ Verify on a live
// test txn — if MizorPay actually wants the full name, pass the raw bank_name here.
function bankCodeFromIfsc(ifsc) {
  return String(ifsc || '').trim().slice(0, 4).toUpperCase();
}

// ─── 1. Initiate payout — AccuzPay calls this ────────────────────────────────
// AccuzPay payload (email + mobile are supplied upstream):
//   { amount, account_number, account_ifsc, bank_name, beneficiary_name,
//     request_type, reference_id, email, mobile }
exports.initiatePayout = async (req, res, next) => {
  try {
    const {
      reference_id, amount,
      account_number, account_ifsc, bank_name, beneficiary_name,
      request_type, email, mobile,
    } = req.body;

    const callback_url = process.env.ACCUZPAY_PAYOUT_CALLBACK_URL || process.env.ACCUZPAY_CALLBACK_URL;
    if (!callback_url) {
      logger.error('[PAYOUT] callback URL not set (ACCUZPAY_PAYOUT_CALLBACK_URL / ACCUZPAY_CALLBACK_URL)');
      return res.status(500).json({ success: false, message: 'Payout gateway misconfigured — callback URL missing' });
    }

    if (!reference_id || !amount || !account_number || !account_ifsc || !beneficiary_name || !email || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: reference_id, amount, account_number, account_ifsc, beneficiary_name, email, mobile',
      });
    }

    // Idempotency — one payout per reference_id.
    const existing = await prisma.payoutTransaction.findUnique({ where: { referenceId: reference_id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Payout with this reference_id already exists' });
    }

    const payoutOrderId = generatePayoutOrderId();
    const bankCode      = bankCodeFromIfsc(account_ifsc);

    // MizorPay requires email + mobile — both come from AccuzPay upstream.
    const beneEmail  = email;
    const beneMobile = String(mobile).replace(/\D/g, '').slice(-10);

    // Persist PENDING first so a callback that races the response still finds the row.
    const payout = await prisma.payoutTransaction.create({
      data: {
        referenceId:         reference_id,
        payoutOrderId,
        amount:              parseFloat(amount),
        mode:                request_type || 'IMPS',
        status:              'PENDING',
        callbackUrl:         callback_url,
        beneficiaryName:     beneficiary_name,
        beneficiaryAccount:  String(account_number),
        beneficiaryIfsc:     account_ifsc,
        beneficiaryBankName: bank_name || bankCode,
        beneficiaryEmail:    beneEmail,
        beneficiaryPhone:    beneMobile,
      },
    });

    // Fire the disbursement.
    const result = await initiateMizorpayPayout({
      transactionId:   payoutOrderId,
      amount,
      accountNumber:   account_number,
      ifsc:            account_ifsc,
      bankName:        bankCode,
      beneficiaryName: beneficiary_name,
      email:           beneEmail,
      mobile:          beneMobile,
    });

    if (!result.queued) {
      await prisma.payoutTransaction.update({
        where: { id: payout.id },
        data:  { status: 'FAILED', failureReason: result.error, providerRaw: result.raw },
      });
      logger.warn({ reference_id, error: result.error }, '[PAYOUT] MizorPay rejected at initiate');
      return res.status(502).json({ success: false, message: result.error, provider_error: result.raw });
    }

    await prisma.payoutTransaction.update({
      where: { id: payout.id },
      data:  { status: 'PROCESSING', providerRaw: result.raw },
    });

    logger.info({ reference_id, payoutOrderId }, '[PAYOUT] MizorPay accepted (queued)');
    return res.status(200).json({
      success:         true,
      reference_id,
      payout_order_id: payoutOrderId,
      status:          'PROCESSING',
      amount:          parseFloat(amount),
    });
  } catch (error) {
    logger.error(`[PAYOUT] initiatePayout error: ${error.message}`);
    if (error.providerError) {
      return res.status(502).json({ success: false, message: error.message, provider_error: error.providerError });
    }
    next(error);
  }
};

// ─── 2. Callback — MizorPay POSTs here on status change ──────────────────────
// The callback is UNSIGNED, so we treat it only as a trigger and re-fetch the
// authoritative status via check-status before forwarding anything to AccuzPay.
exports.handlePayoutWebhook = async (req, res) => {
  try {
    const node  = req.body?.payout || req.body || {};
    const txnId = node.txn_id || node.transaction_id || null;
    logger.info({ txnId, status: node.status }, '[PAYOUT] callback received');

    if (!txnId) {
      logger.warn('[PAYOUT] callback: no txn_id — ignoring');
      return res.status(200).json({ received: true });
    }

    const payout = await prisma.payoutTransaction.findFirst({
      where: { OR: [{ payoutOrderId: txnId }, { referenceId: txnId }] },
    });
    if (!payout) {
      logger.warn(`[PAYOUT] callback: no record for txn_id=${txnId}`);
      return res.status(200).json({ received: true });
    }
    if (payout.status === 'FORWARDED') {
      logger.info(`[PAYOUT] callback: already forwarded — referenceId=${payout.referenceId}`);
      return res.status(200).json({ received: true });
    }

    // Reconcile: trust check-status, not the raw callback body.
    let verified;
    try {
      verified = await checkMizorpayStatus(payout.payoutOrderId);
    } catch (err) {
      logger.error(`[PAYOUT] callback: check-status failed for ${txnId} — ${err.message}; not forwarding`);
      return res.status(200).json({ received: true }); // MizorPay/admin poll will retry
    }

    await applyVerifiedStatus(payout, verified, { callback: req.body });
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`[PAYOUT] callback error: ${error.message}`);
    return res.status(200).json({ received: true }); // always 200 so the provider stops retrying
  }
};

// Shared: persist a verified status and forward terminal outcomes to AccuzPay.
async function applyVerifiedStatus(payout, verified, extraRaw = {}) {
  const status = verified.status; // PENDING | PROCESSING | SUCCESS | FAILED

  await prisma.payoutTransaction.update({
    where: { id: payout.id },
    data: {
      status,
      utr:              verified.utr || payout.utr,
      bankTxnId:        verified.bankTxnId || payout.bankTxnId,
      providerPayoutId: verified.mizorPayTxnId || payout.providerPayoutId,
      refundStatus:     verified.refundStatus || payout.refundStatus,
      failureReason:    status === 'FAILED' ? (verified.message || verified.rawStatus || 'Payout failed') : null,
      providerRaw:      { check: verified.raw, ...extraRaw },
    },
  });

  if (status !== 'SUCCESS' && status !== 'FAILED') {
    logger.info(`[PAYOUT] ${payout.referenceId}: status=${status} — not forwarding yet`);
    return;
  }

  await enqueueForward({
    gateway:           'payout',
    paymentId:         payout.id,
    referenceId:       payout.referenceId,
    callbackUrl:       payout.callbackUrl,
    amount:            parseFloat(payout.amount),
    status:            status === 'SUCCESS' ? 'TXN' : 'FAILED',
    utr:               verified.utr || null,
    paymentIdExternal: verified.mizorPayTxnId || null,
    ...(status === 'FAILED' && { errorMessage: verified.message || verified.rawStatus || 'Payout failed' }),
  });
}

// ─── 3. Status check — AccuzPay polls this ───────────────────────────────────
// Returns DB state, refreshed live from MizorPay if still non-terminal.
exports.checkPayoutTransaction = async (req, res, next) => {
  try {
    const reference_id = req.query.reference_id || req.body.reference_id;
    if (!reference_id) {
      return res.status(400).json({ success: false, message: 'reference_id is required' });
    }

    let payout = await prisma.payoutTransaction.findUnique({ where: { referenceId: reference_id } });
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout not found' });
    }

    // Live refresh while still in flight — also lets polling trigger the forward.
    if (payout.status === 'PENDING' || payout.status === 'PROCESSING') {
      try {
        const verified = await checkMizorpayStatus(payout.payoutOrderId);
        await applyVerifiedStatus(payout, verified);
        payout = await prisma.payoutTransaction.findUnique({ where: { referenceId: reference_id } });
      } catch (err) {
        logger.warn(`[PAYOUT] check: live refresh failed for ${reference_id} — ${err.message}`);
      }
    }

    const dbStatus  = payout.status;
    const isSuccess = dbStatus === 'SUCCESS' || dbStatus === 'FORWARDED';

    return res.status(200).json({
      success:            true,
      reference_id:       payout.referenceId,
      status:             isSuccess ? 'TXN' : dbStatus,
      payout_status:      dbStatus,
      payout_order_id:    payout.payoutOrderId,
      provider_payout_id: payout.providerPayoutId,
      forwarded:          dbStatus === 'FORWARDED',
      amount:             parseFloat(payout.amount),
      utr:                isSuccess ? payout.utr : null,
      bank_txn_id:        payout.bankTxnId,
      refund_status:      payout.refundStatus,
      failure_reason:     dbStatus === 'FAILED' ? payout.failureReason : null,
    });
  } catch (error) {
    logger.error(`[PAYOUT] checkTransaction error: ${error.message}`);
    next(error);
  }
};

// ─── 4. Wallet balance — admin ───────────────────────────────────────────────
exports.getPayoutBalance = async (req, res, next) => {
  try {
    const { balance, raw } = await getMizorpayBalance();
    return res.json({ success: true, balance, raw });
  } catch (error) {
    logger.error(`[PAYOUT] getBalance error: ${error.message}`);
    if (error.providerError) {
      return res.status(502).json({ success: false, message: error.message, provider_error: error.providerError });
    }
    next(error);
  }
};

// ─── 5. Admin — list payouts ─────────────────────────────────────────────────
exports.listPayoutTransactions = async (req, res, next) => {
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
        { payoutOrderId:   { contains: search, mode: 'insensitive' } },
        { beneficiaryName: { contains: search, mode: 'insensitive' } },
        { utr:             { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, transactions] = await Promise.all([
      prisma.payoutTransaction.count({ where }),
      prisma.payoutTransaction.findMany({
        where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' },
        select: {
          id: true, referenceId: true, payoutOrderId: true, providerPayoutId: true,
          amount: true, status: true, mode: true, utr: true, bankTxnId: true, refundStatus: true,
          beneficiaryName: true, beneficiaryBankName: true, beneficiaryIfsc: true,
          failureReason: true, forwardedAt: true, createdAt: true,
        },
      }),
    ]);

    return res.json({
      success: true, data: transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error(`[PAYOUT] listTransactions error: ${error.message}`);
    next(error);
  }
};

// ─── 6. Admin — single payout ────────────────────────────────────────────────
exports.getPayoutTransaction = async (req, res, next) => {
  try {
    const payout = await prisma.payoutTransaction.findUnique({ where: { id: req.params.id } });
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
    return res.json({ success: true, data: payout });
  } catch (error) {
    logger.error(`[PAYOUT] getTransaction error: ${error.message}`);
    next(error);
  }
};
