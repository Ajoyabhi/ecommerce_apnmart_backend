const { gatewayHttp } = require('../../../config/httpClient');
const logger = require('../../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// MIZORPAY PAYOUT SERVICE
//
// Docs: https://payout.mizorpay.in/admin/user-developer
// Auth: two headers — Token-Id + Secret-Key (NOT Basic/Bearer).
// Amounts are in RUPEES (their example sends "amount": 10), not paise.
// Endpoints:
//   POST /payment-initiate-bulk-v3   — initiate (accepts an ARRAY of txns)
//   POST /payout/check-status        — authoritative status by txn_id
//   GET  /check-balance              — wallet balance
// Callbacks are UNSIGNED, so the controller reconciles every callback with
// check-status before trusting it.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.MIZORPAY_BASE_URL || 'https://payout.mizorpay.in/api').replace(/\/$/, '');

function mizorHeaders() {
  return {
    'Token-Id':     process.env.MIZORPAY_TOKEN_ID,
    'Secret-Key':   process.env.MIZORPAY_SECRET_KEY,
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };
}

// Uniform error wrapper — same shape as razorpayRequest() so the controller can
// surface a clean gateway error to AccuzPay.
async function mizorRequest(tag, fn) {
  try {
    return await fn();
  } catch (err) {
    const providerError = err.response?.data;
    logger.error({ providerError, status: err.response?.status }, `[MIZORPAY] ${tag} <- error`);
    const message = providerError?.error
                 || providerError?.message
                 || err.message;
    const error   = new Error(`MizorPay ${tag} failed: ${message}`);
    error.providerError = providerError;
    error.statusCode    = err.response?.status;
    throw error;
  }
}

// ─── 1. Initiate payout (single txn wrapped in the bulk-v3 array) ─────────────
// Returns { queued, transactionId, mizorStatus, error, raw }.
async function initiateMizorpayPayout({
  transactionId, amount, accountNumber, ifsc, bankName, beneficiaryName, email, mobile,
}) {
  const txn = {
    bank_name:              bankName,
    account_number:         String(accountNumber),
    confirm_account_number: String(accountNumber),
    ifsc_code:              ifsc,
    beneficiary_name:       beneficiaryName,
    amount:                 Number(amount),        // RUPEES, not paise
    email,
    mobile:                 String(mobile),
    transaction_id:         transactionId,
  };

  logger.debug({ transactionId, amount, bankName, ifsc }, '[MIZORPAY] initiate -> request');

  return mizorRequest('initiate', async () => {
    const { data } = await gatewayHttp.post(`${BASE_URL}/payment-initiate-bulk-v3`, [txn], {
      headers: mizorHeaders(),
    });

    // Success shape: { success, failed, errors[], successful:[{transaction_id, status:"queued"}] }
    const accepted = Array.isArray(data?.successful)
      && data.successful.some(s => s.transaction_id === transactionId && String(s.status).toLowerCase() === 'queued');

    const error = accepted ? null : extractInitiateError(data, transactionId);
    logger.info({ transactionId, accepted, error }, '[MIZORPAY] initiate <- response');

    return { queued: accepted, transactionId, mizorStatus: accepted ? 'queued' : 'failed', error, raw: data };
  });
}

// Pulls the first human-readable error out of the bulk-v3 error shapes:
//   errors: [ { transaction_id: ["..."] }, { error: "Insufficient wallet balance..." } ]
//   errors: { "0": { transaction_id: ["..."] } }
function extractInitiateError(data, transactionId) {
  const errs = data?.errors;
  if (!errs) return 'Payout not accepted by MizorPay';
  const list = Array.isArray(errs) ? errs : Object.values(errs);
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    if (e.error) return String(e.error);
    for (const v of Object.values(e)) {
      if (Array.isArray(v) && v.length) return String(v[0]);
      if (typeof v === 'string') return v;
    }
  }
  return 'Payout not accepted by MizorPay';
}

// ─── 2. Check status (authoritative) ─────────────────────────────────────────
// Returns a normalized object; `raw` is the full payout node.
async function checkMizorpayStatus(txnId) {
  logger.info({ txnId }, '[MIZORPAY] checkStatus -> request');
  return mizorRequest('checkStatus', async () => {
    const { data } = await gatewayHttp.post(`${BASE_URL}/payout/check-status`, { txn_id: txnId }, {
      headers: mizorHeaders(),
    });
    const p = data?.payout || {};
    const result = {
      status:        normalizeStatus(p.status),
      rawStatus:     p.status || null,
      mizorPayTxnId: p.mizor_pay_txn_id || null,
      utr:           p.utr || null,
      bankTxnId:     p.bank_txn_id || null,
      refundStatus:  p.refund_status || null,
      amount:        p.amount || null,
      message:       p.message || null,
      raw:           p,
    };
    logger.info({ txnId, status: result.status, rawStatus: result.rawStatus }, '[MIZORPAY] checkStatus <- response');
    return result;
  });
}

// ─── 3. Wallet balance ───────────────────────────────────────────────────────
async function getMizorpayBalance() {
  logger.info('[MIZORPAY] checkBalance -> request');
  return mizorRequest('checkBalance', async () => {
    const { data } = await gatewayHttp.get(`${BASE_URL}/check-balance`, { headers: mizorHeaders() });
    logger.info({ balance: data?.balance }, '[MIZORPAY] checkBalance <- response');
    return { balance: data?.balance ?? null, raw: data };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// MizorPay statuses: SUCCESS | PENDING | FAILED | REJECTED (also 'queued' on init).
// Normalized vocab used across the payout module:
//   PENDING | PROCESSING | SUCCESS | FAILED | REVERSED
function normalizeStatus(raw) {
  const s = String(raw || '').toUpperCase();
  if (s === 'SUCCESS')  return 'SUCCESS';
  if (s === 'FAILED')   return 'FAILED';
  if (s === 'REJECTED') return 'FAILED';   // terminal like FAILED; refund_status carries the reversal
  if (s === 'QUEUED')   return 'PROCESSING';
  return 'PENDING';
}

module.exports = {
  initiateMizorpayPayout,
  checkMizorpayStatus,
  getMizorpayBalance,
  normalizeStatus,
};
