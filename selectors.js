/**
 * Shopify-specific CSS selectors for product page elements
 * These selectors target common Shopify themes and popular review apps
 */

module.exports = {
  /**
   * Price selectors - common Shopify price classes and patterns
   */
  price: [
    '.price',
    '.product-price',
    '.product__price',
    '.price__regular',
    '.price-item',
    '[class*="price"]',
    '[data-price]',
    '.money',
    '.product-single__price',
    '.price-container',
    '.current_price',
    'span.price-item--sale',
  ],

  /**
   * Review widget selectors - popular Shopify review apps
   * Judge.me, Loox, Yotpo, Stamped.io, Rivyo, etc.
   */
  reviews: [
    // Judge.me
    '.jdgm-widget',
    '.jdgm-preview-badge',
    '.jdgm-star-rating',
    '[data-jdgm]',

    // Loox
    '.loox-rating',
    '[class*="loox"]',

    // Yotpo
    '.yotpo',
    '.yotpo-widget',
    '.yotpo-bottomline',
    '[data-yotpo]',

    // Stamped.io
    '.stamped-badge',
    '.stamped-reviews',
    '[data-stamped]',

    // Rivyo
    '.rivyo-widget',

    // Product reviews (generic)
    '.product-reviews',
    '.reviews',
    '.review-widget',
    '.star-rating',
    '.rating',
    '[class*="review"]',
    '[class*="rating"]',
    '[data-reviews]',
    '.shopify-product-reviews',
    '#shopify-product-reviews',
  ],

  /**
   * Shipping-related keywords to search in page text
   */
  shippingKeywords: [
    'free shipping',
    'free delivery',
    'shipping',
    'delivery',
    'ships free',
    'complimentary shipping',
    'we ship',
    'standard shipping',
    'express shipping',
    'shipping cost',
    'shipping info',
    'delivery time',
  ],
};
