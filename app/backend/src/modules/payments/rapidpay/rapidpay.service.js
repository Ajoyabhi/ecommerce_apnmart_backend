const { gatewayHttp } = require('../../../config/httpClient');
const logger = require('../../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// RAPIDPAY SERVICE — collection (payin) + disbursement (payout)
//
// Auth: two headers — X-Api-Key + X-Api-Secret.
// Amounts: `txn_amount` as a RUPEE string ("100"), not paise.
// Every call is POST + JSON and answers HTTP 200 with an envelope:
//   { status_code: "SUCCESS"|"FAILED", response_message, payload }
// so success MUST be read from status_code, not the HTTP status.
//
// Endpoints (base: RAPIDPAY_BASE_URL):
//   /collection/initiate     /collection/status     /collection/balance
//   /disbursement/initiate   /disbursement/status   /disbursement/balance
//
// ⚠️ The /status endpoints are IP-whitelisted ("invalid ip address - x.x.x.x");
//    the server's egress IP must be registered with RapidPay.
// ⚠️ The initiate/status `payload` shapes are not documented yet — the field
//    pickers below (pick()) accept several likely names. Tighten them after the
//    first live transaction (check the `raw` stored on the row).
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.RAPIDPAY_BASE_URL || 'https://www.rapidpaypayments.com/api/v1').replace(/\/$/, '');

function rapidpayHeaders() {
  return {
    'X-Api-Key':    process.env.RAPIDPAY_API_KEY,
    'X-Api-Secret': process.env.RAPIDPAY_API_SECRET,
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };
}

// POST + envelope check. Throws (with .providerError) on transport errors and on
// status_code !== SUCCESS, same contract as razorpayRequest()/mizorRequest().
async function rapidpayPost(tag, path, body) {
  let data;
  try {
    ({ data } = await gatewayHttp.post(`${BASE_URL}${path}`, body, { headers: rapidpayHeaders() }));
  } catch (err) {
    const providerError = err.response?.data;
    logger.error({ providerError, status: err.response?.status }, `[RAPIDPAY] ${tag} <- http error`);
    const error = new Error(`RapidPay ${tag} failed: ${providerError?.response_message || err.message}`);
    error.providerError = providerError;
    error.statusCode    = err.response?.status;
    throw error;
  }

  if (String(data?.status_code).toUpperCase() !== 'SUCCESS') {
    logger.error({ providerError: data }, `[RAPIDPAY] ${tag} <- rejected`);
    const error = new Error(`RapidPay ${tag} failed: ${data?.response_message || 'unknown error'}`);
    error.providerError = data;
    throw error;
  }

  return data;
}

// First non-empty value among candidate keys of an object.
function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

// RapidPay transaction statuses → our vocab: SUCCESS | FAILED | PENDING
function normalizeStatus(raw) {
  const s = String(raw || '').toUpperCase();
  if (['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID', 'CAPTURED', 'TXN'].includes(s)) return 'SUCCESS';
  if (['FAILED', 'FAILURE', 'REJECTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'REVERSED', 'REFUNDED'].includes(s)) return 'FAILED';
  return 'PENDING';
}

// Status payload → normalized view shared by collection and disbursement.
function parseStatusPayload(payload) {
  const p = Array.isArray(payload) ? payload[0] : (payload || {});
  // Confirmed live: webhook → event_status; collection/status → payload.get_intent_status;
  // collection/initiate → payload.status
  const rawStatus = pick(p, 'event_status', 'get_intent_status', 'txn_status', 'status', 'transaction_status', 'payment_status');
  return {
    status:       normalizeStatus(rawStatus),
    rawStatus:    rawStatus || null,
    utr:          pick(p, 'utr', 'rrn', 'bank_ref_no', 'bank_reference', 'utr_no'),
    providerTxnId: pick(p, 'txn_id', 'transaction_id', 'order_id', 'rapidpay_txn_id', 'id'),
    amount:       pick(p, 'txn_amount', 'amount'),
    message:      pick(p, 'message', 'remarks', 'reason', 'response_message'),
    raw:          p,
  };
}

// ─── Webhook trust + polling budget ──────────────────────────────────────────

// RapidPay webhook source IPs (confirmed: 98.130.9.92). Comma-separated override.
// req.ip is the real client IP: nginx sets X-Forwarded-For, app has trust proxy = 1.
function webhookIps() {
  return (process.env.RAPIDPAY_WEBHOOK_IPS || '98.130.9.92')
    .split(',').map(s => s.trim()).filter(Boolean);
}

function isTrustedWebhookIp(req) {
  const ip = String(req.ip || '').replace(/^::ffff:/, '');
  return webhookIps().includes(ip);
}

// Missed-webhook reconciliation budget for the AccuzPay check endpoints:
//  - terminal rows (SUCCESS/FAILED) never hit RapidPay
//  - PENDING rows hit RapidPay only once they are older than
//    RAPIDPAY_LIVE_CHECK_AFTER_SEC (default 180s — a normal webhook arrives in seconds)
//  - and then at most once per RAPIDPAY_LIVE_CHECK_INTERVAL_SEC (default 60s) per txn,
//    shared across all pm2 workers via a Redis SET NX lock.
async function shouldLiveCheck(row, kind) {
  if (row.status !== 'PENDING' && row.status !== 'PROCESSING') return false;

  const afterSec    = parseInt(process.env.RAPIDPAY_LIVE_CHECK_AFTER_SEC || '180', 10);
  const intervalSec = parseInt(process.env.RAPIDPAY_LIVE_CHECK_INTERVAL_SEC || '60', 10);
  if (Date.now() - new Date(row.createdAt).getTime() < afterSec * 1000) return false;

  try {
    const { redisClient } = require('../../../config/database');
    const ok = await redisClient.set(`rapidpay:livecheck:${kind}:${row.id}`, '1', { NX: true, EX: intervalSec });
    return ok === 'OK';
  } catch (err) {
    logger.warn(`[RAPIDPAY] livecheck lock unavailable (${err.message}) — skipping live check`);
    return false;
  }
}

// ─── Collection (payin) ───────────────────────────────────────────────────────

async function initiateCollection({ referenceId, amount, name, email, phone }) {
  const body = {
    reference_id: referenceId,
    txn_amount:   String(amount),
    payer_name:   name,
    payer_email:  email,
    payer_phone:  String(phone),
  };
  logger.debug({ referenceId, amount }, '[RAPIDPAY] collection/initiate -> request');
  const data = await rapidpayPost('collection/initiate', '/collection/initiate', body);
  const p = data.payload || {};

  const upiIntentUri = pick(p, 'upi_intent', 'upi_intent_uri', 'intent_url', 'upi_link', 'payment_link',
                               'upi_string', 'qr_string', 'qrcode_string', 'intent', 'link', 'url');
  const providerTxnId = pick(p, 'txn_id', 'transaction_id', 'order_id', 'rapidpay_txn_id', 'id');

  logger.info({ referenceId, providerTxnId, hasIntent: !!upiIntentUri }, '[RAPIDPAY] collection/initiate <- response');
  return { upiIntentUri, providerTxnId, raw: data };
}

async function checkCollectionStatus(referenceId) {
  logger.info({ referenceId }, '[RAPIDPAY] collection/status -> request');
  const data   = await rapidpayPost('collection/status', '/collection/status', { reference_id: referenceId });
  const result = parseStatusPayload(data.payload);
  logger.info({ referenceId, status: result.status, rawStatus: result.rawStatus }, '[RAPIDPAY] collection/status <- response');
  return { ...result, raw: data };
}

async function getCollectionBalance() {
  const data = await rapidpayPost('collection/balance', '/collection/balance', {});
  return { balance: data?.payload?.balance ?? null, raw: data };
}

// ─── Disbursement (payout) ────────────────────────────────────────────────────

async function initiateDisbursement({
  referenceId, amount, beneficiaryName, accountNumber, bankName, ifsc, phone, email,
}) {
  const body = {
    reference_id:     referenceId,
    txn_amount:       String(amount),
    beneficiary_name: beneficiaryName,
    account_number:   String(accountNumber),
    bank_name:        bankName,
    ifsc,
    phone:            String(phone),
    email,
  };
  logger.debug({ referenceId, amount, ifsc }, '[RAPIDPAY] disbursement/initiate -> request');
  const data = await rapidpayPost('disbursement/initiate', '/disbursement/initiate', body);
  const parsed = parseStatusPayload(data.payload);
  logger.info({ referenceId, providerTxnId: parsed.providerTxnId, rawStatus: parsed.rawStatus }, '[RAPIDPAY] disbursement/initiate <- response');
  return { ...parsed, raw: data };
}

async function checkDisbursementStatus(referenceId) {
  logger.info({ referenceId }, '[RAPIDPAY] disbursement/status -> request');
  const data   = await rapidpayPost('disbursement/status', '/disbursement/status', { reference_id: referenceId });
  const result = parseStatusPayload(data.payload);
  logger.info({ referenceId, status: result.status, rawStatus: result.rawStatus }, '[RAPIDPAY] disbursement/status <- response');
  return { ...result, raw: data };
}

async function getDisbursementBalance() {
  const data = await rapidpayPost('disbursement/balance', '/disbursement/balance', {});
  return { balance: data?.payload?.balance ?? null, raw: data };
}

module.exports = {
  initiateCollection,
  checkCollectionStatus,
  getCollectionBalance,
  initiateDisbursement,
  checkDisbursementStatus,
  getDisbursementBalance,
  normalizeStatus,
  parseStatusPayload,
  isTrustedWebhookIp,
  shouldLiveCheck,
};
