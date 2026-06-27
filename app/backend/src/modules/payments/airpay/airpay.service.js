const crypto = require('crypto');
const axios  = require('axios');
const logger = require('../../../utils/logger');

const BASE_URL = 'https://kraken.airpay.co.in/airpay/pay/v4/api';

// ─── Crypto helpers ───────────────────────────────────────────────────────────

// Mirrors PHP: $iv = bin2hex(random_bytes(8)); $out = $iv . base64_encode(raw)
function airpayEncrypt(data, secretKey) {
  const iv     = crypto.randomBytes(8).toString('hex'); // 16 hex chars
  const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
  const raw    = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  return iv + raw.toString('base64');
}

// Mirrors PHP: $iv = substr($r, 0, 16); base64_decode(substr($r, 16))
function airpayDecrypt(response, secretKey) {
  const iv            = response.substring(0, 16);
  const encryptedData = Buffer.from(response.substring(16), 'base64');
  const decipher      = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');
}

// Mirrors PHP ksort → concat values → SHA256(str + date('Y-m-d'))
// Uses IST date so it matches AirPay's server-side checksum validation
function airpayChecksum(data) {
  const str   = Object.keys(data).sort().map(k => String(data[k])).join('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  return crypto.createHash('sha256').update(str + today).digest('hex');
}

// ─── Access token with in-memory cache ───────────────────────────────────────

let _tokenCache = { token: null, expiresAt: 0 };

async function getAirpayAccessToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const merchantId   = process.env.AIRPAY_MERCHANT_ID;
  const clientId     = process.env.AIRPAY_CLIENT_ID;
  const clientSecret = process.env.AIRPAY_CLIENT_SECRET;
  const secretKey    = process.env.AIRPAY_SECRET_KEY;

  const data = {
    client_id:     clientId,
    client_secret: clientSecret,
    merchant_id:   merchantId,
    grant_type:    'client_credentials',
  };

  const payload = new URLSearchParams({
    merchant_id: merchantId,
    encdata:     airpayEncrypt(JSON.stringify(data), secretKey),
    checksum:    airpayChecksum(data),
    // no privatekey for OAuth2
  });

  logger.info('[AIRPAY] getAccessToken → request');

  const { data: raw } = await axios.post(`${BASE_URL}/oauth2/`, payload.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!raw?.response) {
    throw new Error(`AirPay OAuth2 failed: ${JSON.stringify(raw)}`);
  }

  const decrypted  = JSON.parse(airpayDecrypt(raw.response, secretKey));
  const token = decrypted?.data?.access_token;
  logger.info('[AIRPAY] OAuth token preview', { tokenSnippet: token?.substring(0, 20), fullDecrypted: JSON.stringify(decrypted) });

  if (!token) {
    throw new Error(`AirPay access_token missing in response: ${JSON.stringify(decrypted)}`);
  }

  // Conservative 50-min cache (tokens are typically valid for 60 min)
  _tokenCache = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  logger.info('[AIRPAY] getAccessToken ← token acquired and cached');

  return token;
}

// ─── Generate QR / UPI Intent ─────────────────────────────────────────────────

async function generateAirpayQr({ airpayOrderId, amount, buyerEmail, buyerPhone }) {
  const merchantId   = process.env.AIRPAY_MERCHANT_ID;
  const username     = process.env.AIRPAY_USERNAME;
  const password     = process.env.AIRPAY_PASSWORD;
  const secret = process.env.AIRPAY_SECRET;
  const secretKey    = process.env.AIRPAY_SECRET_KEY;

  const data = {
    orderid:          airpayOrderId,
    amount:           Number(amount).toFixed(2),
    buyer_email:      buyerEmail,
    buyer_phone:      String(buyerPhone),
    call_type:        'upiqr',
    customer_consent: 'Y',
  };

  // mer_dom is optional — only include it if a domain is explicitly configured,
  // because AirPay rejects unregistered domains with U04
  if (process.env.AIRPAY_MERCHANT_DOMAIN) {
    data.mer_dom = Buffer.from(process.env.AIRPAY_MERCHANT_DOMAIN).toString('base64');
  }

  // private key uses client_secret (not secret) — matches the PHP reference code
  const privatekey = crypto
    .createHash('sha256')
    .update(`${secret}@${username}:|:${password}`)
    .digest('hex');

  const token   = await getAirpayAccessToken();
  const payload = new URLSearchParams({
    merchant_id: merchantId,
    encdata:     airpayEncrypt(JSON.stringify(data), secretKey),
    checksum:    airpayChecksum(data),
    privatekey,
  });

  logger.info({ airpayOrderId, amount }, '[AIRPAY] generateQr → request');

  const { data: raw } = await axios.post(
    `${BASE_URL}/generateorder/?token=${token}`,
    payload.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  if (!raw?.response) {
    throw new Error(`AirPay generateorder failed: ${JSON.stringify(raw)}`);
  }

  const decrypted    = JSON.parse(airpayDecrypt(raw.response, secretKey));
  const upiIntentUri = decrypted?.data?.qrcode_string;

  if (!upiIntentUri) {
    throw new Error(`AirPay qrcode_string missing: ${JSON.stringify(decrypted)}`);
  }

  const apTransactionId = decrypted?.data?.ap_transactionid || null;
  logger.info({ airpayOrderId, apTransactionId }, '[AIRPAY] generateQr ← success');

  return { upiIntentUri, apTransactionId, raw: decrypted };
}

// ─── Verify / Status Check ────────────────────────────────────────────────────

async function verifyAirpayPayment(airpayOrderId) {
  const merchantId = process.env.AIRPAY_MERCHANT_ID;
  const username   = process.env.AIRPAY_USERNAME;
  const password   = process.env.AIRPAY_PASSWORD;
  const secret     = process.env.AIRPAY_SECRET;      // different from client_secret
  const secretKey  = process.env.AIRPAY_SECRET_KEY;

  const data = {
    merchant_id: merchantId,
    orderid:     airpayOrderId,
  };

  // private key uses secret (not client_secret) — matches the PHP reference code
  const privatekey = crypto
    .createHash('sha256')
    .update(`${secret}@${username}:|:${password}`)
    .digest('hex');

  const token   = await getAirpayAccessToken();
  const payload = new URLSearchParams({
    merchant_id: merchantId,
    encdata:     airpayEncrypt(JSON.stringify(data), secretKey),
    checksum:    airpayChecksum(data),
    privatekey,
  });

  logger.info({ airpayOrderId }, '[AIRPAY] verifyPayment → request');

  const { data: raw } = await axios.post(
    `${BASE_URL}/verify/?token=${token}`,
    payload.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  if (!raw?.response) {
    throw new Error(`AirPay verify failed: ${JSON.stringify(raw)}`);
  }

  const decrypted = JSON.parse(airpayDecrypt(raw.response, secretKey));
  logger.info({ airpayOrderId, decrypted }, '[AIRPAY] verifyPayment ← response');

  return decrypted;
}

module.exports = { generateAirpayQr, verifyAirpayPayment, getAirpayAccessToken, airpayDecrypt };
