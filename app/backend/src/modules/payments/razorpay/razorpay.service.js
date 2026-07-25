const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../../utils/logger');

const BASE_URL = 'https://api.razorpay.com/v1';

function authHeader() {
  const encoded = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');
  return `Basic ${encoded}`;
}

async function razorpayRequest(tag, fn) {
  try {
    return await fn();
  } catch (err) {
    const razorpayError = err.response?.data;
    logger.error({ razorpayError, status: err.response?.status }, `[RAZORPAY] ${tag} <- error`);
    const message = razorpayError?.error?.description || razorpayError?.error?.reason || err.message;
    const error   = new Error(`Razorpay ${tag} failed: ${message}`);
    error.razorpayError = razorpayError;
    error.statusCode    = err.response?.status;
    throw error;
  }
}

// ─── ACTIVE FLOW: S2S UPI Intent ─────────────────────────────────────────────

async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  const body = {
    amount:  Math.round(amount * 100),
    currency,
    receipt: receipt.slice(0, 40),
    notes,
  };
  logger.info({ body }, '[RAZORPAY] createOrder -> request');
  return razorpayRequest('createOrder', async () => {
    const { data } = await axios.post(`${BASE_URL}/orders`, body, {
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    });
    logger.info({ orderId: data.id, status: data.status }, '[RAZORPAY] createOrder <- response');
    return data;
  });
}

async function initiateRazorpayUpiIntent({ amount, currency = 'INR', razorpayOrderId, contact, email, callbackUrl }) {
  const body = {
    amount:   Math.round(amount * 100),
    currency,
    order_id: razorpayOrderId,
    method:   'upi',
    contact,
    email,
    referer:  process.env.BACKEND_PUBLIC_URL || 'https://store.anpamart.com',
    upi:          { flow: 'intent' },
    callback_url: callbackUrl || undefined,
  };
  logger.info({ body }, '[RAZORPAY] initiateUpiIntent -> request');
  return razorpayRequest('initiateUpiIntent', async () => {
    const { data } = await axios.post(`${BASE_URL}/payments/create/upi`, body, {
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    });
    logger.info({ paymentId: data.razorpay_payment_id }, '[RAZORPAY] initiateUpiIntent <- response');
    return data;
  });
}

// ─── ORDER STATUS & PAYMENTS ──────────────────────────────────────────────────

async function fetchRazorpayOrder(orderId) {
  logger.info({ orderId }, '[RAZORPAY] fetchOrder -> request');
  return razorpayRequest('fetchOrder', async () => {
    const { data } = await axios.get(`${BASE_URL}/orders/${orderId}`, {
      headers: { Authorization: authHeader() },
    });
    logger.info({ orderId, status: data.status, amountPaid: data.amount_paid }, '[RAZORPAY] fetchOrder <- response');
    return data;
  });
}

async function fetchOrderPayments(orderId) {
  logger.info({ orderId }, '[RAZORPAY] fetchOrderPayments -> request');
  return razorpayRequest('fetchOrderPayments', async () => {
    const { data } = await axios.get(`${BASE_URL}/orders/${orderId}/payments`, {
      headers: { Authorization: authHeader() },
    });
    logger.info({ orderId, count: data.count }, '[RAZORPAY] fetchOrderPayments <- response');
    return data;
  });
}

// ─── SHARED ───────────────────────────────────────────────────────────────────

async function fetchRazorpayPayment(paymentId) {
  logger.info({ paymentId }, '[RAZORPAY] fetchPayment -> request');
  return razorpayRequest('fetchPayment', async () => {
    const { data } = await axios.get(`${BASE_URL}/payments/${paymentId}`, {
      headers: { Authorization: authHeader() },
    });
    logger.info({ paymentId, status: data.status }, '[RAZORPAY] fetchPayment <- response');
    return data;
  });
}

function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

module.exports = {
  createRazorpayOrder,
  initiateRazorpayUpiIntent,
  fetchRazorpayOrder,
  fetchOrderPayments,
  fetchRazorpayPayment,
  verifyRazorpayWebhookSignature,
};
