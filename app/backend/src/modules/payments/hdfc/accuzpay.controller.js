const { prisma } = require('../../../config/database');
const logger = require('../../../utils/logger');
const axios = require('axios');
const fs = require('fs');
const {
  createHdfcOrder,
  initiateUpiIntent,
  buildUpiIntentUri,
  getHdfcOrderStatus,
} = require('./hdfc.service');
const { generateAndSaveInvoice, getInvoiceFilePath } = require('../../../services/invoice.service');

function generateHdfcOrderId() {
  return `H${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    .slice(0, 21)
    .toUpperCase();
}

// ─── 1. Initiate payin from accuzpay ─────────────────────────────────────────
exports.initiateAccuzpayPayin = async (req, res, next) => {
  try {
    const { reference_id, amount, name, email, phone, customerId, address } = req.body;

    // callback_url is fixed — configured once in ACCUZPAY_CALLBACK_URL env var,
    // not passed per-request (it's always https://dashboard.accuzpay.in/api/payments/hdfc/callback)
    const callback_url = process.env.ACCUZPAY_CALLBACK_URL;
    if (!callback_url) {
      logger.error('[HDFC-ACCUZPAY] ACCUZPAY_CALLBACK_URL not set in environment');
      return res.status(500).json({ success: false, message: 'Payment gateway misconfigured — callback URL missing' });
    }

    if (!reference_id || !amount || !email || !customerId) {
      return res.status(400).json({ success: false, message: 'Missing required fields: reference_id, amount, email, customerId' });
    }

    const existing = await prisma.accuzpayPayment.findUnique({ where: { referenceId: reference_id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Transaction with this reference_id already exists' });
    }

    const hdfcOrderId = generateHdfcOrderId();
    const cleanPhone = phone?.replace(/\D/g, '').slice(-10) || '';

    const payment = await prisma.accuzpayPayment.create({
      data: {
        referenceId:     reference_id,
        hdfcOrderId,
        customerId,
        amount:          parseFloat(amount),
        status:          'PENDING',
        callbackUrl:     callback_url,
        customerName:    name   || null,
        customerEmail:   email,
        customerPhone:   cleanPhone || null,
        shippingAddress: address || null,
      },
    });

    const returnUrl = `${process.env.BACKEND_PUBLIC_URL}/api/v1/payments/hdfc/pg-notify`;

    await createHdfcOrder({
      hdfcOrderId,
      amount,
      customerId,
      customerEmail: email,
      customerPhone: cleanPhone,
      returnUrl,
    });

    const txnResponse = await initiateUpiIntent({ hdfcOrderId, customerId });
    logger.info({ txnResponse }, '[HDFC-ACCUZPAY] initiateUpiIntent response');

    const sdkParams    = txnResponse.sdk_params || txnResponse.payment?.sdk_params || {};
    const upiIntentUri = buildUpiIntentUri(sdkParams);
    const txnId        = txnResponse.txn_id || null;

    await prisma.accuzpayPayment.update({
      where: { id: payment.id },
      data:  { txnId, upiIntentUri, sdkParams },
    });

    return res.status(200).json({ success: true, upiIntentUri, hdfcOrderId, txnId });
  } catch (error) {
    logger.error(`[HDFC-ACCUZPAY] initiateAccuzpayPayin error: ${error.message}`);
    next(error);
  }
};

// ─── 2. Receive HDFC payment notification (return_url POST) ──────────────────
exports.handlePgNotify = async (req, res, next) => {
  try {
    const payload     = req.body;
    const hdfcOrderId = payload.order_id || payload.id;
    logger.info({ payload }, '[HDFC-ACCUZPAY] pg-notify received');

    if (!hdfcOrderId) {
      return res.status(200).json({ received: true });
    }

    const payment = await prisma.accuzpayPayment.findUnique({ where: { hdfcOrderId } });
    if (!payment) {
      logger.warn(`[HDFC-ACCUZPAY] pg-notify: no AccuzpayPayment for hdfcOrderId=${hdfcOrderId}`);
      return res.status(200).json({ received: true });
    }

    if (payment.status === 'FORWARDED') {
      logger.info(`[HDFC-ACCUZPAY] pg-notify: already forwarded — hdfcOrderId=${hdfcOrderId}`);
      return res.status(200).json({ received: true });
    }

    // Verify status server-side — never trust POST body alone
    let liveStatus;
    let hdfcData = null;
    try {
      hdfcData   = await getHdfcOrderStatus(hdfcOrderId, payment.customerId);
      liveStatus = hdfcData.status;
      logger.info({ hdfcOrderId, liveStatus }, '[HDFC-ACCUZPAY] server-side status verified');
    } catch (err) {
      logger.error(`[HDFC-ACCUZPAY] status check failed: ${err.message} — using payload status`);
      liveStatus = payload.status;
    }

    const terminalStatuses = ['CHARGED', 'AUTHORIZATION_FAILED', 'AUTHENTICATION_FAILED', 'JUSPAY_DECLINED'];
    if (!terminalStatuses.includes(liveStatus)) {
      await prisma.accuzpayPayment.update({ where: { id: payment.id }, data: { status: liveStatus } });
      logger.info(`[HDFC-ACCUZPAY] intermediate status ${liveStatus} — not forwarding yet`);
      return res.status(200).json({ received: true });
    }

    const accuzpayStatus = liveStatus === 'CHARGED' ? 'TXN' : 'FAILED';

    // UTR (rrn) only exists for CHARGED — bank never assigns one for failed payments
    const utr        = liveStatus === 'CHARGED'
      ? (hdfcData?.payment_gateway_response?.rrn || payload?.payment_gateway_response?.rrn || null)
      : null;

    // For failed payments, pass error context so accuzpay knows the reason
    const errorCode    = liveStatus !== 'CHARGED'
      ? (hdfcData?.bank_error_code    || hdfcData?.txn_detail?.error_code    || null)
      : null;
    const errorMessage = liveStatus !== 'CHARGED'
      ? (hdfcData?.bank_error_message || hdfcData?.txn_detail?.error_message || null)
      : null;

    await prisma.accuzpayPayment.update({
      where: { id: payment.id },
      data:  { status: liveStatus, forwardedAt: new Date() },
    });

    try {
      await axios.post(
        payment.callbackUrl,
        {
          reference_id:  payment.referenceId,
          status:        accuzpayStatus,
          utr,
          amount:        parseFloat(payment.amount),
          ...(errorCode    && { error_code:    errorCode }),
          ...(errorMessage && { error_message: errorMessage }),
        },
        {
          headers:  { 'x-api-key': process.env.ACCUZPAY_SHARED_SECRET, 'Content-Type': 'application/json' },
          timeout:  10000,
        }
      );

      await prisma.accuzpayPayment.update({ where: { id: payment.id }, data: { status: 'FORWARDED' } });
      logger.info(`[HDFC-ACCUZPAY] forwarded to accuzpay: referenceId=${payment.referenceId} status=${accuzpayStatus}`);
    } catch (fwdErr) {
      logger.error(`[HDFC-ACCUZPAY] forward to accuzpay failed: ${fwdErr.message} — will retry on next webhook`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`[HDFC-ACCUZPAY] handlePgNotify error: ${error.message}`);
    return res.status(200).json({ received: true }); // always 200 to HDFC
  }
};

// ─── 3. Transaction status check — called by accuzpay to poll payment status ──
exports.checkAccuzpayTransaction = async (req, res, next) => {
  try {
    const reference_id = req.query.reference_id || req.body.reference_id;

    if (!reference_id) {
      return res.status(400).json({ success: false, message: 'reference_id is required' });
    }

    const payment = await prisma.accuzpayPayment.findUnique({ where: { referenceId: reference_id } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Fetch live status from HDFC
    let liveStatus = payment.status;
    let hdfcData   = null;
    try {
      hdfcData   = await getHdfcOrderStatus(payment.hdfcOrderId, payment.customerId);
      console.log("this is hdfcData ========>>>>>>>>>>.", hdfcData);
      liveStatus = hdfcData.status || liveStatus;
      logger.info({ reference_id, liveStatus }, '[HDFC-ACCUZPAY] checkTransaction live status');
    } catch (err) {
      logger.warn(`[HDFC-ACCUZPAY] checkTransaction: HDFC status fetch failed — using DB status. ${err.message}`);
    }

    // Sync DB if status changed and is terminal
    const terminalStatuses = ['CHARGED', 'AUTHORIZATION_FAILED', 'AUTHENTICATION_FAILED', 'JUSPAY_DECLINED', 'FORWARDED'];
    if (liveStatus !== payment.status && terminalStatuses.includes(liveStatus)) {
      await prisma.accuzpayPayment.update({ where: { id: payment.id }, data: { status: liveStatus } });
    }

    const accuzpayStatus = liveStatus === 'CHARGED' || liveStatus === 'FORWARDED' ? 'TXN' : liveStatus;

    const utr        = liveStatus === 'CHARGED'
      ? (hdfcData?.payment_gateway_response?.rrn || null)
      : null;
    const errorCode    = liveStatus !== 'CHARGED'
      ? (hdfcData?.bank_error_code    || hdfcData?.txn_detail?.error_code    || null)
      : null;
    const errorMessage = liveStatus !== 'CHARGED'
      ? (hdfcData?.bank_error_message || hdfcData?.txn_detail?.error_message || null)
      : null;

    return res.status(200).json({
      success:      true,
      reference_id: payment.referenceId,
      status:       accuzpayStatus,
      hdfc_status:  liveStatus,
      amount:       parseFloat(payment.amount),
      utr,
      hdfcOrderId:  payment.hdfcOrderId,
      ...(errorCode    && { error_code:    errorCode }),
      ...(errorMessage && { error_message: errorMessage }),
    });
  } catch (error) {
    logger.error(`[HDFC-ACCUZPAY] checkTransaction error: ${error.message}`);
    next(error);
  }
};

// ─── 5. List accuzpay transactions ───────────────────────────────────────────
exports.listAccuzpayTransactions = async (req, res, next) => {
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
      prisma.accuzpayPayment.count({ where }),
      prisma.accuzpayPayment.findMany({
        where,
        skip,
        take:    parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, referenceId: true, hdfcOrderId: true, amount: true,
          status: true, customerName: true, customerEmail: true,
          customerPhone: true, upiIntentUri: true, createdAt: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data:    transactions.map(t => ({ ...t, hasItems: t._count.items > 0 })),
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error(`[HDFC-ACCUZPAY] listTransactions error: ${error.message}`);
    next(error);
  }
};

// ─── 4. Get single transaction ────────────────────────────────────────────────
exports.getAccuzpayTransaction = async (req, res, next) => {
  try {
    const payment = await prisma.accuzpayPayment.findUnique({
      where:   { id: req.params.id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, basePrice: true } }, variant: true },
        },
      },
    });

    if (!payment) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.json({ success: true, data: payment });
  } catch (error) {
    logger.error(`[HDFC-ACCUZPAY] getTransaction error: ${error.message}`);
    next(error);
  }
};

// ─── 5. Search products for item selector ────────────────────────────────────
exports.searchProducts = async (req, res, next) => {
  try {
    const { q, maxPrice } = req.query;

    const where = { status: 'published' };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku:  { contains: q, mode: 'insensitive' } },
      ];
    }
    if (maxPrice) where.basePrice = { lte: parseFloat(maxPrice) };

    const products = await prisma.product.findMany({
      where,
      take: 50,
      select: {
        id: true, name: true, sku: true, basePrice: true,
        variants: {
          where:  { isActive: true },
          select: { id: true, name: true, priceAdjustment: true, sku: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, data: products });
  } catch (error) {
    logger.error(`[HDFC-ACCUZPAY] searchProducts error: ${error.message}`);
    next(error);
  }
};

// ─── 6. Save selected items for a transaction ────────────────────────────────
exports.saveTransactionItems = async (req, res, next) => {
  try {
    const payment = await prisma.accuzpayPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ success: false, message: 'Transaction not found' });

    const allowedStatuses = ['CHARGED', 'FORWARDED'];
    if (!allowedStatuses.includes(payment.status)) {
      return res.status(400).json({ success: false, message: 'Invoice can only be created for paid transactions' });
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }

    // Fetch each product/variant and build item rows
    const itemRows = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });

      let unitPrice = parseFloat(product.basePrice);
      let variantName = null;

      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
        if (!variant) return res.status(400).json({ success: false, message: `Variant not found: ${item.variantId}` });
        unitPrice  += parseFloat(variant.priceAdjustment);
        variantName = variant.name;
      }

      const qty        = parseInt(item.quantity) || 1;
      const totalPrice = parseFloat((unitPrice * qty).toFixed(2));

      itemRows.push({
        productId:   item.productId,
        variantId:   item.variantId || null,
        productName: product.name,
        variantName,
        unitPrice,
        quantity:    qty,
        totalPrice,
      });
    }

    const selectedTotal = itemRows.reduce((sum, r) => sum + r.totalPrice, 0);
    const txnAmount     = parseFloat(payment.amount);
    const diff          = Math.abs(selectedTotal - txnAmount);

    if (diff > 1) {
      return res.status(400).json({
        success:       false,
        message:       `Selected items total ₹${selectedTotal.toFixed(2)} does not match transaction amount ₹${txnAmount.toFixed(2)} (difference: ₹${diff.toFixed(2)})`,
        selectedTotal,
        txnAmount,
      });
    }

    // Replace existing items and save new ones atomically
    await prisma.$transaction([
      prisma.accuzpayPaymentItem.deleteMany({ where: { paymentId: payment.id } }),
      prisma.accuzpayPaymentItem.createMany({
        data: itemRows.map(r => ({ ...r, paymentId: payment.id })),
      }),
    ]);

    const saved = await prisma.accuzpayPaymentItem.findMany({ where: { paymentId: payment.id } });
    return res.json({ success: true, items: saved, selectedTotal });
  } catch (error) {
    logger.error(`[HDFC-ACCUZPAY] saveTransactionItems error: ${error.message}`);
    next(error);
  }
};

// ─── 7. Download invoice ──────────────────────────────────────────────────────
exports.downloadInvoice = async (req, res, next) => {
  try {
    const payment = await prisma.accuzpayPayment.findUnique({
      where:   { id: req.params.id },
      include: { items: { include: { product: true, variant: true } } },
    });

    if (!payment) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (!payment.items.length) {
      return res.status(400).json({ success: false, message: 'No items selected for this transaction. Please select products first.' });
    }

    const selectedTotal = payment.items.reduce((sum, i) => sum + parseFloat(i.totalPrice), 0);
    if (Math.abs(selectedTotal - parseFloat(payment.amount)) > 1) {
      return res.status(400).json({ success: false, message: 'Item total does not match transaction amount' });
    }

    const addr = (payment.shippingAddress && typeof payment.shippingAddress === 'object')
      ? payment.shippingAddress : {};

    // Build order-compatible object for existing invoice generator
    const orderObj = {
      orderNumber:    `ACCUZ-${payment.referenceId}`,
      createdAt:      payment.createdAt,
      total:          payment.amount,
      subtotal:       payment.amount,
      taxAmount:      0,
      shippingAmount: 0,
      paymentMethod:  'UPI',
      paymentStatus:  'paid',
      shippingAddress: {
        fullName:     payment.customerName || '',
        phone:        payment.customerPhone || '',
        addressLine1: addr.line1 || '',
        addressLine2: addr.line2 || '',
        city:         addr.city  || '',
        state:        addr.state || '',
        pincode:      addr.pincode || '',
        country:      addr.country || 'India',
      },
      user: {
        name:  payment.customerName  || '',
        email: payment.customerEmail || '',
      },
      items: payment.items.map(item => ({
        productName: item.productName,
        variantName: item.variantName || '',
        sku:         item.variant?.sku || item.product?.sku || '',
        unitPrice:   item.unitPrice,
        quantity:    item.quantity,
        totalPrice:  item.totalPrice,
      })),
    };

    const filePath = await generateAndSaveInvoice(orderObj);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${payment.referenceId}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    logger.error(`[HDFC-ACCUZPAY] downloadInvoice error: ${error.message}`);
    next(error);
  }
};
