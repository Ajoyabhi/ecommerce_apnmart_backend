const { prisma } = require('../../../config/database');
const logger   = require('../../../utils/logger');
const {
  initiateDisbursement,
  checkDisbursementStatus,
  getDisbursementBalance,
} = require('./rapidpay.service');
const { enqueueForward } = require('../../../queues');

// Our id sent to RapidPay as the disbursement `reference_id`.
function generateRapidpayPayoutId() {
  return `RPD${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    .slice(0, 30)
    .toUpperCase();
}

// Persist a verified status and forward terminal outcomes to AccuzPay once.
// Returns the refreshed row.
async function applyVerifiedStatus(payout, verified) {
  const isTerminal = payout.status === 'SUCCESS' || payout.status === 'FAILED';
  const status     = (isTerminal && verified.status === 'PENDING') ? payout.status
                   : verified.status === 'PENDING' ? 'PROCESSING'   // accepted, in flight
                   : verified.status;

  const updated = await prisma.rapidpayPayout.update({
    where: { id: payout.id },
    data: {
      status,
      utr:           verified.utr || payout.utr,
      providerTxnId: verified.providerTxnId || payout.providerTxnId,
      failureReason: status === 'FAILED' ? (verified.message || verified.rawStatus || 'Payout failed') : null,
      providerRaw:   verified.raw,
    },
  });

  if (!payout.forwardedAt && (status === 'SUCCESS' || status === 'FAILED')) {
    await enqueueForward({
      gateway:           'rapidpay_payout',
      paymentId:         updated.id,
      referenceId:       updated.referenceId,
      callbackUrl:       updated.callbackUrl,
      amount:            parseFloat(updated.amount),
      status:            status === 'SUCCESS' ? 'TXN' : 'FAILED',
      utr:               status === 'SUCCESS' ? (updated.utr || null) : null,
      paymentIdExternal: updated.providerTxnId || null,
      ...(status === 'FAILED' && { errorMessage: updated.failureReason }),
    });
  }
  return updated;
}

// ─── 1. Initiate disbursement — AccuzPay calls this ──────────────────────────
// Same AccuzPay payload as /payout/initiate (MizorPay):
//   { reference_id, amount, account_number, account_ifsc, bank_name,
//     beneficiary_name, request_type, email, mobile }

exports.initiateRapidpayPayout = async (req, res, next) => {
  try {
    const {
      reference_id, amount,
      account_number, account_ifsc, bank_name, beneficiary_name,
      request_type, email, mobile,
    } = req.body;

    const callback_url = process.env.ACCUZPAY_PAYOUT_CALLBACK_URL || process.env.ACCUZPAY_CALLBACK_URL;
    if (!callback_url) {
      logger.error('[RAPIDPAY-PAYOUT] callback URL not set (ACCUZPAY_PAYOUT_CALLBACK_URL / ACCUZPAY_CALLBACK_URL)');
      return res.status(500).json({ success: false, message: 'Payout gateway misconfigured — callback URL missing' });
    }

    if (!reference_id || !amount || !account_number || !account_ifsc || !bank_name || !beneficiary_name || !email || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: reference_id, amount, account_number, account_ifsc, bank_name, beneficiary_name, email, mobile',
      });
    }

    const existing = await prisma.rapidpayPayout.findUnique({ where: { referenceId: reference_id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Payout with this reference_id already exists' });
    }

    const rapidpayPayoutId = generateRapidpayPayoutId();
    const beneMobile       = String(mobile).replace(/\D/g, '').slice(-10);

    // Persist PENDING first so a callback that races the response still finds the row.
    const payout = await prisma.rapidpayPayout.create({
      data: {
        referenceId:         reference_id,
        rapidpayPayoutId,
        amount:              parseFloat(amount),
        mode:                request_type || null,
        status:              'PENDING',
        callbackUrl:         callback_url,
        beneficiaryName:     beneficiary_name,
        beneficiaryAccount:  String(account_number),
        beneficiaryIfsc:     account_ifsc,
        beneficiaryBankName: bank_name,
        beneficiaryEmail:    email,
        beneficiaryPhone:    beneMobile,
      },
    });

    let result;
    try {
      result = await initiateDisbursement({
        referenceId:     rapidpayPayoutId,
        amount,
        beneficiaryName: beneficiary_name,
        accountNumber:   account_number,
        bankName:        bank_name,       // RapidPay's example uses the human name ("HDFC Bank")
        ifsc:            account_ifsc,
        phone:           beneMobile,
        email,
      });
    } catch (err) {
      // Envelope FAILED / transport error at initiate → nothing was disbursed.
      await prisma.rapidpayPayout.update({
        where: { id: payout.id },
        data:  { status: 'FAILED', failureReason: err.message, providerRaw: err.providerError || null },
      });
      logger.warn({ reference_id, error: err.message }, '[RAPIDPAY-PAYOUT] rejected at initiate');
      return res.status(502).json({ success: false, message: err.message, provider_error: err.providerError || null });
    }

    const updated = await applyVerifiedStatus(payout, result);

    logger.info({ reference_id, rapidpayPayoutId, status: updated.status }, '[RAPIDPAY-PAYOUT] accepted');
    return res.status(200).json({
      success:            true,
      reference_id,
      rapidpay_payout_id: rapidpayPayoutId,
      rapidpay_txn_id:    updated.providerTxnId,
      status:             updated.status === 'SUCCESS' ? 'TXN' : updated.status,
      amount:             parseFloat(amount),
    });
  } catch (error) {
    logger.error(`[RAPIDPAY-PAYOUT] initiatePayout error: ${error.message}`);
    next(error);
  }
};

// ─── 2. RapidPay disbursement callback — trigger only, re-verified ───────────

exports.handleRapidpayPayoutWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const node = body.payload || body.data || body;
    const ref  = node.reference_id || node.referenceId || body.reference_id || null;
    logger.info({ ref, body }, '[RAPIDPAY-PAYOUT] webhook received');

    if (!ref) return res.status(200).json({ received: true });

    const payout = await prisma.rapidpayPayout.findFirst({
      where: { OR: [{ rapidpayPayoutId: ref }, { referenceId: ref }] },
    });
    if (!payout || payout.forwardedAt) return res.status(200).json({ received: true });

    try {
      const verified = await checkDisbursementStatus(payout.rapidpayPayoutId);
      await applyVerifiedStatus(payout, verified);
    } catch (err) {
      logger.error(`[RAPIDPAY-PAYOUT] webhook: status verify failed for ${ref} — ${err.message}; not forwarding`);
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`[RAPIDPAY-PAYOUT] webhook error: ${error.message}`);
    return res.status(200).json({ received: true });
  }
};

// ─── 3. Status check — AccuzPay polls this ───────────────────────────────────

exports.checkRapidpayPayout = async (req, res, next) => {
  try {
    const reference_id = req.query.reference_id || req.body?.reference_id;
    if (!reference_id) {
      return res.status(400).json({ success: false, message: 'reference_id is required' });
    }

    let payout = await prisma.rapidpayPayout.findUnique({ where: { referenceId: reference_id } });
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout not found' });
    }

    if (payout.status === 'PENDING' || payout.status === 'PROCESSING') {
      try {
        const verified = await checkDisbursementStatus(payout.rapidpayPayoutId);
        payout = await applyVerifiedStatus(payout, verified);
      } catch (err) {
        logger.warn(`[RAPIDPAY-PAYOUT] check: live refresh failed for ${reference_id} — ${err.message}`);
      }
    }

    const isSuccess = payout.status === 'SUCCESS';
    return res.status(200).json({
      success:            true,
      reference_id:       payout.referenceId,
      status:             isSuccess ? 'TXN' : payout.status,
      payout_status:      payout.status,
      rapidpay_payout_id: payout.rapidpayPayoutId,
      rapidpay_txn_id:    payout.providerTxnId,
      forwarded:          !!payout.forwardedAt,
      amount:             parseFloat(payout.amount),
      utr:                isSuccess ? payout.utr : null,
      failure_reason:     payout.status === 'FAILED' ? payout.failureReason : null,
    });
  } catch (error) {
    logger.error(`[RAPIDPAY-PAYOUT] checkPayout error: ${error.message}`);
    next(error);
  }
};

// ─── 4. Disbursement wallet balance ──────────────────────────────────────────

exports.getRapidpayPayoutBalance = async (req, res, next) => {
  try {
    const { balance } = await getDisbursementBalance();
    return res.json({ success: true, balance });
  } catch (error) {
    logger.error(`[RAPIDPAY-PAYOUT] balance error: ${error.message}`);
    if (error.providerError) {
      return res.status(502).json({ success: false, message: error.message, provider_error: error.providerError });
    }
    next(error);
  }
};

// ─── 5. Admin — list / single ────────────────────────────────────────────────

exports.listRapidpayPayouts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { referenceId:      { contains: search, mode: 'insensitive' } },
        { rapidpayPayoutId: { contains: search, mode: 'insensitive' } },
        { beneficiaryName:  { contains: search, mode: 'insensitive' } },
        { utr:              { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await Promise.all([
      prisma.rapidpayPayout.count({ where }),
      prisma.rapidpayPayout.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    ]);
    return res.json({
      success: true, data,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error(`[RAPIDPAY-PAYOUT] list error: ${error.message}`);
    next(error);
  }
};

exports.getRapidpayPayout = async (req, res, next) => {
  try {
    const payout = await prisma.rapidpayPayout.findUnique({ where: { id: req.params.id } });
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
    return res.json({ success: true, data: payout });
  } catch (error) {
    logger.error(`[RAPIDPAY-PAYOUT] get error: ${error.message}`);
    next(error);
  }
};
