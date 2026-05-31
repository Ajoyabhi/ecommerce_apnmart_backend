const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Proxy to avoid ERR_CERT_DATE_INVALID on api.postalpincode.in from the browser
router.get('/:pincode', async (req, res) => {
  const { pincode } = req.params;

  if (!/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ error: 'Invalid pincode format' });
  }

  try {
    const { data } = await axios.get(
      `https://api.postalpincode.in/pincode/${pincode}`,
      { httpsAgent, timeout: 8000 }
    );
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach pincode API', detail: err.message });
  }
});

module.exports = router;
