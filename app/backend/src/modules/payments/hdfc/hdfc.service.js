const axios = require('axios');
const logger = require('../../../utils/logger');

const BASE_URL = process.env.HDFC_ENV === 'production'
    ? 'https://smartgateway.hdfc.bank.in'
    : 'https://smartgateway.hdfcuat.bank.in';

function authHeader() {
    const encoded = Buffer.from(process.env.HDFC_API_KEY).toString('base64');
    return `Basic ${encoded}`;
}

function commonHeaders(customerId) {
    return {
        Authorization: authHeader(),
        'x-merchantid': process.env.HDFC_MERCHANT_ID,
        'x-routing-id': customerId,
        'x-resellerid': 'hdfc_reseller',
    };
}

/**
 * Register the order with HDFC before initiating UPI intent.
 */
async function createHdfcOrder({ hdfcOrderId, amount, customerId, customerEmail, customerPhone, returnUrl }) {
    const today = new Date().toISOString().split('T')[0];
    const body = {
        order_id: hdfcOrderId,
        amount: Number(amount).toFixed(2),
        customer_id: customerId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        return_url: returnUrl,
    };

    logger.info({ body, url: `${BASE_URL}/orders` }, '[HDFC] createOrder → request');

    const { data } = await axios.post(`${BASE_URL}/orders`, body, {
        headers: {
            ...commonHeaders(customerId),
            'Content-Type': 'application/json',
            version: today,
        },
    });

    logger.info({ data }, '[HDFC] createOrder ← response');
    return data;
}

/**
 * Initiate UPI intent transaction — returns sdk_params to build the upi:// URI.
 */
async function initiateUpiIntent({ hdfcOrderId, customerId }) {
    const params = new URLSearchParams({
        order_id: hdfcOrderId,
        merchant_id: process.env.HDFC_MERCHANT_ID,
        payment_method_type: 'UPI',
        payment_method: 'UPI_PAY',
        txn_type: 'UPI_PAY',
        sdk_params: 'true',
        format: 'json',
    });

    logger.info({ params: params.toString(), url: `${BASE_URL}/txns` }, '[HDFC] initiateUpiIntent → request');

    const { data } = await axios.post(`${BASE_URL}/txns`, params.toString(), {
        headers: {
            Authorization: authHeader(),
            'x-merchantid': process.env.HDFC_MERCHANT_ID,
            'x-resellerid': 'hdfc_reseller',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    logger.info({ data }, '[HDFC] initiateUpiIntent ← response');
    return data;
}

/**
 * Build the upi://pay URI from sdk_params returned by HDFC.
 * Uses pgIntentUrl if provided, otherwise constructs it from individual fields.
 */
function buildUpiIntentUri(sdkParams) {
    if (sdkParams.pgIntentUrl) return sdkParams.pgIntentUrl;

    // HDFC TranPortal returns merchant_vpa / merchant_name / amount
    // (not pa / pn / am as in some other integrations)
    const tr  = sdkParams.tr;
    const tid = sdkParams.tid;
    const pa  = sdkParams.merchant_vpa  || sdkParams.pa;
    const pn  = sdkParams.merchant_name || sdkParams.pn;
    const am  = sdkParams.amount        || sdkParams.am;
    const mc  = sdkParams.mcc           || sdkParams.mc || '';
    const cu  = 'INR';
    const tn  = 'Payment';

    const enc = (v) => encodeURIComponent(v || '');
    const mcPart = mc ? `&mc=${mc}` : '';
    return `upi://pay?ver=01&mode=04&tr=${enc(tr)}&tid=${enc(tid)}&pa=${enc(pa)}&pn=${enc(pn)}&am=${am}${mcPart}&cu=${cu}&tn=${enc(tn)}&qrMedium=06`;
}

/**
 * Poll payment status for an HDFC order.
 */
async function getHdfcOrderStatus(hdfcOrderId, customerId) {
    const { data } = await axios.get(
        `${BASE_URL}/orders/${hdfcOrderId}`,
        {
            headers: {
                ...commonHeaders(customerId),
                'Content-Type': 'application/json',
            },
        }
    );
    return data;
}

module.exports = { createHdfcOrder, initiateUpiIntent, buildUpiIntentUri, getHdfcOrderStatus };
