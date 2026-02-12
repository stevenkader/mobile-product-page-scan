# Mobile Product Page Scan

Railway-ready Node.js API service that analyzes Shopify product pages on mobile viewport and detects:
- Reviews (above fold, below fold, or not present)
- Price visibility
- Shipping information mentions

Returns a mobile screenshot and structured JSON results.

## Features

- Playwright-based headless browser scanning
- Mobile viewport (390x844 iPhone dimensions)
- Screenshot capture (above-the-fold only)
- Multi-platform review widget detection (Judge.me, Loox, Yotpo, Stamped.io, etc.)
- Rate limiting (3-second cooldown per IP)
- CORS-enabled REST API
- Static file serving for screenshots

## Tech Stack

- Node.js
- Express
- Playwright
- Docker (Playwright base image)

## Environment Variables

**Required:**

- `BASE_URL` - Your deployed service URL (e.g., `https://your-app.up.railway.app`)

**Optional:**

- `PORT` - Server port (defaults to 3000, Railway sets this automatically)

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Set environment variable
export BASE_URL=http://localhost:3000

# Start server
npm start
```

Server runs at `http://localhost:3000`

### Test the API

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example-store.myshopify.com/products/sample-product"}'
```

## Railway Deployment

### 1. Create New Project

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git remote add origin git@github.com:stevenkader/mobile-product-page-scan.git
git push -u origin main
```

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `mobile-product-page-scan` repository
5. Railway auto-detects the Dockerfile and deploys

### 3. Configure Environment Variables

In Railway project settings:

1. Go to "Variables" tab
2. Add variable:
   - Key: `BASE_URL`
   - Value: Your Railway-provided URL (e.g., `https://mobile-product-page-scan-production.up.railway.app`)

### 4. Verify Deployment

```bash
curl https://your-railway-url.up.railway.app/
```

Expected response:
```json
{
  "status": "healthy",
  "service": "mobile-product-page-scan",
  "version": "1.0.0"
}
```

## API Reference

### Health Check

**GET /**

Returns service status.

**Response:**
```json
{
  "status": "healthy",
  "service": "mobile-product-page-scan",
  "version": "1.0.0"
}
```

### Scan Product Page

**POST /scan**

Analyzes a product page URL on mobile viewport.

**Request Body:**
```json
{
  "url": "https://example-store.myshopify.com/products/sample-product"
}
```

**Response:**
```json
{
  "screenshotUrl": "https://your-app.up.railway.app/scans/scan-1234567890.png",
  "results": {
    "reviews": "visible_above_fold",
    "price": "visible_above_fold",
    "shipping": "present"
  }
}
```

**Field Values:**

- `reviews`: `"visible_above_fold"` | `"present_below_fold"` | `"not_present"`
- `price`: `"visible_above_fold"` | `"not_visible_above_fold"`
- `shipping`: `"present"` | `"not_present"`

**Error Responses:**

```json
{
  "error": "Missing URL",
  "message": "Request body must include a \"url\" field"
}
```

```json
{
  "error": "Invalid URL",
  "message": "The provided URL is not valid"
}
```

```json
{
  "error": "Rate limit exceeded",
  "message": "Please wait 2 seconds before making another request"
}
```

```json
{
  "error": "Scan failed",
  "message": "Scan failed: Navigation timeout of 30000 ms exceeded"
}
```

## Example Request

```bash
curl -X POST https://your-app.up.railway.app/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://gymshark.com/products/gymshark-speed-t-shirt-black"
  }'
```

## Example Response

```json
{
  "screenshotUrl": "https://your-app.up.railway.app/scans/scan-1707789012345.png",
  "results": {
    "reviews": "visible_above_fold",
    "price": "visible_above_fold",
    "shipping": "present"
  }
}
```

## Rate Limiting

- 3-second cooldown per IP address
- In-memory implementation (resets on service restart)
- Returns 429 status code when exceeded

## Supported Review Platforms

- Judge.me
- Loox
- Yotpo
- Stamped.io
- Rivyo
- Generic Shopify review widgets

## License

MIT
