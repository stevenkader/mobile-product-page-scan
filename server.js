const express = require('express');
const cors = require('cors');
const path = require('path');
const { scanProductPage } = require('./scan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve screenshots from /scans
app.use('/scans', express.static(path.join(__dirname, 'public', 'scans')));

// Simple in-memory rate limiting (3-second cooldown per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_MS = 3000;

function checkRateLimit(ip) {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(ip);

  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    const waitTime = Math.ceil((RATE_LIMIT_MS - (now - lastRequest)) / 1000);
    return { allowed: false, waitTime };
  }

  rateLimitMap.set(ip, now);
  return { allowed: true };
}

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'mobile-product-page-scan',
    version: '1.0.0'
  });
});

// Main scan endpoint
app.post('/scan', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  // Rate limiting
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Please wait ${rateCheck.waitTime} seconds before making another request`
    });
  }

  // URL validation
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'Missing URL',
      message: 'Request body must include a "url" field'
    });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({
      error: 'Invalid URL',
      message: 'The provided URL is not valid'
    });
  }

  // Execute scan
  try {
    const result = await scanProductPage(url, {
      baseUrl: process.env.BASE_URL
    });

    res.json(result);
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({
      error: 'Scan failed',
      message: err.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`BASE_URL: ${process.env.BASE_URL || 'NOT SET - REQUIRED FOR PRODUCTION'}`);
});
