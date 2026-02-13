// scan.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const selectors = require('./selectors');

/**
 * Locked mobile viewport
 */
const VIEWPORT = { width: 390, height: 844 };

/**
 * Element must occupy real pixels to be considered visible.
 * (Prevents Loox zero-height anchors/togglers from counting.)
 */
function isVisuallyPresent(boundingBox) {
  if (!boundingBox) return false;
  const MIN_DIMENSION = 8;
  return boundingBox.width >= MIN_DIMENSION && boundingBox.height >= MIN_DIMENSION;
}

/**
 * Exclude media/gallery elements from review detection.
 */
async function isMediaElement(element) {
  try {
    return await element.evaluate((el) => {
      const tagName = el.tagName?.toLowerCase();
      const mediaTags = ['media-gallery', 'img', 'picture', 'video', 'canvas', 'figure', 'iframe'];
      if (mediaTags.includes(tagName)) return true;

      const className = el.className || '';
      if (typeof className === 'string') {
        const c = className.toLowerCase();
        if (c.includes('gallery') || c.includes('carousel') || c.includes('slider') || c.includes('media')) {
          return true;
        }
      }
      return false;
    });
  } catch {
    return true;
  }
}

/**
 * Exclude navigation/header/menu contexts from review detection.
 */
async function isInNavigationContext(element) {
  try {
    return await element.evaluate((el) => {
      let current = el;
      while (current && current !== document.body) {
        const tagName = current.tagName?.toLowerCase();
        if (tagName === 'header' || tagName === 'nav') return true;

        const role = current.getAttribute?.('role');
        if (role === 'navigation' || role === 'menu' || role === 'menubar') return true;

        const className = current.className || '';
        if (typeof className === 'string') {
          const c = className.toLowerCase();
          if (
            c.includes('header') ||
            c.includes('nav') ||
            c.includes('menu') ||
            c.includes('site-nav') ||
            c.includes('navbar')
          ) {
            return true;
          }
        }

        current = current.parentElement;
      }
      return false;
    });
  } catch {
    return true;
  }
}

/**
 * Positive allowlist: element must contain explicit review evidence.
 */
async function hasReviewContent(element) {
  try {
    return await element.evaluate((el) => {
      const html = el.innerHTML || '';
      const text = el.textContent || '';
      const className = el.className || '';
      const id = el.id || '';
      const attrs = (className + ' ' + id).toLowerCase();

      const knownWidgets = ['jdgm', 'yotpo', 'loox', 'stamped', 'rivyo', 'reviewsio', 'trustpilot'];
      for (const w of knownWidgets) {
        if (attrs.includes(w)) return true;
      }

      const hasStars =
        (html.includes('<svg') && /star|rating/i.test(html)) ||
        /[★☆⭐]/.test(text) ||
        /fa-star|icon-star|star-icon|icon_star/i.test(html);

      const hasRating =
        /\b[0-5]\.\d+\s*(?:\/\s*5|out\s+of\s+5)?\b/i.test(text) ||
        /\b[0-5]\.\d+\s*[★☆⭐]/.test(text) ||
        /[★☆⭐]{2,}/.test(text);

      const hasCount = /\d+\s+(review|rating)s?/i.test(text) || (/\(\d+\)/.test(text) && /(review|rating)/i.test(text));

      return hasStars || hasRating || hasCount;
    });
  } catch {
    return false;
  }
}

/**
 * Detects reviews state:
 * - visible_above_fold
 * - present_below_fold
 * - not_present
 */
async function detectReviews(page, diagnosticsEnabled = false) {
  const diagnostics = {
    candidatesFound: 0,
    filteredByMedia: 0,
    filteredByNavigation: 0,
    filteredByContent: 0,
    filteredByVisibility: 0,
    validElements: 0,
    aboveFold: [],
    belowFold: [],
  };

  try {
    const reviewCandidates = [];
    for (const selector of selectors.reviews) {
      try {
        const els = await page.$$(selector);
        reviewCandidates.push(...els);
      } catch {
        // ignore selector failures
      }
    }

    diagnostics.candidatesFound = reviewCandidates.length;
    if (reviewCandidates.length === 0) {
      return { state: 'not_present', diagnostics };
    }

    const validReviewElements = [];

    for (const el of reviewCandidates) {
      try {
        if (await isMediaElement(el)) {
          diagnostics.filteredByMedia++;
          continue;
        }
        if (await isInNavigationContext(el)) {
          diagnostics.filteredByNavigation++;
          continue;
        }
        if (!(await hasReviewContent(el))) {
          diagnostics.filteredByContent++;
          continue;
        }
        validReviewElements.push(el);
      } catch {
        // conservative skip
      }
    }

    diagnostics.validElements = validReviewElements.length;
    if (validReviewElements.length === 0) {
      return { state: 'not_present', diagnostics };
    }

    for (const el of validReviewElements) {
      try {
        const box = await el.boundingBox();

        if (!isVisuallyPresent(box)) {
          diagnostics.filteredByVisibility++;
          continue;
        }

        if (!diagnosticsEnabled) {
          if (box.y < VIEWPORT.height) {
            diagnostics.aboveFold.push({ position: box });
            // Early exit — we already know it's above fold
            break;
          } else {
            diagnostics.belowFold.push({ position: box });
          }
          continue;
        }

        const details = await el.evaluate((node) => ({
          tagName: node.tagName,
          className: node.className,
          id: node.id,
          textPreview: node.textContent?.substring(0, 120) || '',
        }));

        const record = { ...details, position: box };

        if (box.y < VIEWPORT.height) diagnostics.aboveFold.push(record);
        else diagnostics.belowFold.push(record);
      } catch {
        // element disappeared; ignore
      }
    }

    const state =
      diagnostics.aboveFold.length > 0
        ? 'visible_above_fold'
        : diagnostics.belowFold.length > 0
          ? 'present_below_fold'
          : 'not_present';
    return { state, diagnostics };
  } catch {
    return { state: 'not_present', diagnostics };
  }
}

/**
 * Detects price visibility above the fold:
 * - visible_above_fold
 * - not_visible_above_fold
 */
async function detectPrice(page) {
  try {
    for (const selector of selectors.price) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements) {
          try {
            const box = await el.boundingBox();
            if (box && box.y < VIEWPORT.height && box.width > 0 && box.height > 0) {
              return 'visible_above_fold';
            }
          } catch {
            // ignore element failures
          }
        }
      } catch {
        // ignore selector failures
      }
    }
    return 'not_visible_above_fold';
  } catch {
    return 'not_visible_above_fold';
  }
}

/**
 * Detects whether shipping is mentioned anywhere on the page:
 * - present
 * - not_present
 */
async function detectShipping(page) {
  try {
    const bodyText = (await page.textContent('body')) || '';
    const textLower = bodyText.toLowerCase();

    for (const keyword of selectors.shippingKeywords) {
      if (textLower.includes(String(keyword).toLowerCase())) {
        return 'present';
      }
    }
    return 'not_present';
  } catch {
    return 'not_present';
  }
}

/**
 * Detects modal/overlay presence using:
 * 1. Semantic selectors (fast path)
 * 2. Area-based heuristic (fallback for non-semantic modals)
 *
 * Returns: 'present' | 'not_present'
 */
async function detectModal(page) {
  try {
    return await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const viewportArea = vw * vh;
      const COVERAGE_THRESHOLD = 0.3;

      // --- Fast path: semantic modal selectors ---
      const semanticSelectors = [
        '[role="dialog"]',
        '[aria-modal="true"]',
        '.modal.show',
        '.modal.active',
        '.modal.open',
        '.modal[style*="display: block"]',
        '.modal[style*="display:block"]',
        '.overlay.active',
        '.popup.visible',
        '.fancybox-is-open',
        '.swal2-shown',
      ];

      for (const sel of semanticSelectors) {
        try {
          const el = document.querySelector(sel);
          if (!el) continue;
          const s = window.getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return 'present';
        } catch {
          continue;
        }
      }

      // --- Fallback: area-based heuristic over all elements ---
      const all = document.querySelectorAll('body *');

      for (const node of all) {
        const s = window.getComputedStyle(node);

        // Skip invisible elements early
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) continue;

        // Only consider overlay-like positioning
        const pos = s.position;
        const zIndex = parseInt(s.zIndex, 10);
        const hasHighZ = !isNaN(zIndex) && zIndex >= 100;
        const isOverlayPositioned = pos === 'fixed' || pos === 'sticky' || (pos === 'absolute' && hasHighZ);
        if (!isOverlayPositioned) continue;

        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;

        // Calculate visible area clamped to viewport
        const visibleWidth = Math.min(rect.right, vw) - Math.max(rect.left, 0);
        const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
        if (visibleWidth <= 0 || visibleHeight <= 0) continue;

        const visibleArea = visibleWidth * visibleHeight;
        if (visibleArea >= viewportArea * COVERAGE_THRESHOLD) {
          return 'present';
        }
      }

      return 'not_present';
    });
  } catch {
    return 'not_present';
  }
}

/**
 * Main scanner entrypoint
 *
 * @param {string} url
 * @param {object} options
 * @param {string} options.baseUrl - Required in production
 * @param {boolean} options.includeDiagnostics - Dev only
 * @param {string} options.scansDir - Defaults to ./public/scans
 */async function scanProductPage(url, options = {}) {
  const {
    baseUrl = process.env.BASE_URL || '',
    includeDiagnostics = false,
    scansDir = path.join(__dirname, 'public', 'scans'),
  } = options;

  if (!baseUrl) {
    throw new Error('BASE_URL is required (env BASE_URL or options.baseUrl).');
  }

  let browser;
  try {
    fs.mkdirSync(scansDir, { recursive: true });

    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for modals — many popups have intentional delays (3-5s)
    // Poll for modal presence over a window, rather than one fixed wait
    let modalState = 'not_present';
    const MODAL_POLL_INTERVAL = 500;
    const MODAL_MAX_WAIT = 12000;
    let elapsed = 0;

    while (elapsed < MODAL_MAX_WAIT) {
      await page.waitForTimeout(MODAL_POLL_INTERVAL);
      elapsed += MODAL_POLL_INTERVAL;
      modalState = await detectModal(page);
    //  console.log(JSON.stringify({ event: 'modal_check', state: modalState, elapsed, url }));
      //if (modalState === 'present') break;
    }

    // Screenshot AFTER modal detection so we capture the actual state
    const filename = `scan-${Date.now()}.png`;
    const filePath = path.join(scansDir, filename);

    await page.screenshot({
      path: filePath,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
    });

    const reviewsResult = await detectReviews(page, includeDiagnostics);
    const priceState = await detectPrice(page);
    const shippingState = await detectShipping(page);

    const response = {
      screenshotUrl: `${baseUrl.replace(/\/$/, '')}/scans/${filename}`,
      results: {
        reviews: reviewsResult.state,
        price: priceState,
        shipping: shippingState,
        modal: modalState,
      },
    };

    if (includeDiagnostics) {
      response.diagnostics = { reviews: reviewsResult.diagnostics };
    }

    await browser.close();
    return response;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw new Error(`Scan failed: ${err.message}`);
  }
}

module.exports = { scanProductPage, VIEWPORT };