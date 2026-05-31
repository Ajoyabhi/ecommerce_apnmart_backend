const express = require('express');
const https = require('https');
const router = express.Router();

// Proxy to avoid ERR_CERT_DATE_INVALID on api.postalpincode.in from the browser
router.get('/:pincode', (req, res) => {
  const { pincode } = req.params;

  if (!/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ error: 'Invalid pincode format' });
  }

  const url = `https://api.postalpincode.in/pincode/${pincode}`;

  // Allow expired/invalid certs on this known third-party endpoint
  const agent = new https.Agent({ rejectUnauthorized: false });

  https.get(url, { agent }, (upstream) => {
    let body = '';
    upstream.on('data', (chunk) => { body += chunk; });
    upstream.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.json(data);
      } catch {
        res.status(502).json({ error: 'Invalid response from pincode API' });
      }
    });
  }).on('error', (err) => {
    res.status(502).json({ error: 'Failed to reach pincode API', detail: err.message });
  });
});

module.exports = router;
