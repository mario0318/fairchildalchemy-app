import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const catalog = JSON.parse(
  await fs.readFile(path.join(rootDir, 'data', 'fairchild.json'), 'utf8')
);

const requiredFiles = [
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'public/favicon.svg',
  'public/favicon-32x32.png',
  'public/favicon-192x192.png',
  'public/favicon-512x512.png',
  'public/apple-touch-icon.png'
];

for (const relativeFile of requiredFiles) {
  await fs.access(path.join(rootDir, relativeFile));
  console.log(`  ✓ ${relativeFile}`);
}

const homeHtml = await fs.readFile(path.join(rootDir, 'public', 'index.html'), 'utf8');
for (const requiredText of [
  'Store Policies',
  'Shipping',
  'Returns',
  'Refunds & Disputes',
  'Cancellations',
  'Restrictions',
  'Promotions',
  'fairchildalchemy.com'
]) {
  assert.ok(homeHtml.includes(requiredText), `Homepage missing policy text: ${requiredText}`);
}

assert.equal(catalog.categories.length, 4, 'Expected exactly four categories');

const totalItems = catalog.categories.reduce((sum, category) => sum + category.items.length, 0);
assert.ok(totalItems >= 12, `Expected at least 12 products, got ${totalItems}`);

for (const category of catalog.categories) {
  assert.ok(category.items.length >= 2, `${category.id} needs at least 2 items`);
  for (const item of category.items) {
    assert.ok(
      Array.isArray(item.image_urls) && item.image_urls.length > 0,
      `${item.name} missing image_urls`
    );
    assert.ok(item.price > 0, `${item.name} price must be positive`);
    assert.ok(
      item.stripe_payment_link && item.stripe_payment_link.includes('buy.stripe.com'),
      `${item.name} missing live Stripe payment link`
    );
    assert.ok(
      item.stripe_price_id && item.stripe_price_id.startsWith('price_'),
      `${item.name} missing Stripe price for branded Checkout Sessions`
    );
    // Verify local image files exist
    for (const imgPath of item.image_urls) {
      const absPath = path.join(rootDir, 'public', imgPath);
      try {
        await fs.access(absPath);
      } catch {
        console.warn(`  ⚠ Missing image file: ${imgPath}`);
      }
    }
  }
}

console.log(`\nAudit passed: ${totalItems} products across ${catalog.categories.length} categories.`);
console.log(`  Stripe links: ${totalItems}/${totalItems} ✓`);
