module.exports = function accuzpayAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.ACCUZPAY_SHARED_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};
