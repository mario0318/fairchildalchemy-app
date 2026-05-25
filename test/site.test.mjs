import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('catalog satisfies Fairchild spec', async () => {
  const catalog = JSON.parse(
    await fs.readFile(path.join(rootDir, 'data', 'fairchild.json'), 'utf8')
  );

  assert.equal(catalog.brand.name, 'Fairchild Alchemy');
  assert.ok(catalog.brand.about, 'brand.about must exist');
  assert.equal(catalog.categories.length, 4);

  const totalItems = catalog.categories.reduce((sum, category) => sum + category.items.length, 0);
  assert.ok(totalItems >= 12, `Expected at least 12 products, got ${totalItems}`);

  for (const category of catalog.categories) {
    assert.ok(category.items.length >= 2, `${category.id} must have at least 2 items`);
    for (const item of category.items) {
      assert.ok(Array.isArray(item.image_urls) && item.image_urls.length > 0, `${item.name} missing image_urls`);
      assert.ok(item.price > 0, `${item.name} must have a positive price`);
      assert.ok(
        item.stripe_payment_link && item.stripe_payment_link.includes('buy.stripe.com'),
        `${item.name} must have a live Stripe payment link`
      );
      assert.ok(
        item.stripe_price_id && item.stripe_price_id.startsWith('price_'),
        `${item.name} must have a Stripe price for branded Checkout Sessions`
      );
    }
  }
});

test('server responds with homepage, health, and data', async () => {
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();

  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const home = await fetch(baseUrl);
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert.match(homeHtml, /Fairchild Alchemy/);
    assert.match(homeHtml, /Store Policies/);
    assert.match(homeHtml, /Refunds & Disputes/);
    assert.match(homeHtml, /US shipping address/);

    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: 'fairchildalchemy-app' });

    const data = await fetch(`${baseUrl}/data/fairchild.json`);
    assert.equal(data.status, 200);
    const json = await data.json();
    assert.equal(json.categories.length, 4);
    assert.equal(json.categories[0].id, 'sanctum');

    const contactMissing = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', message: '' })
    });
    assert.equal(contactMissing.status, 400);

    const contactUnconfigured = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA', email: 'qa@example.com', message: 'Hello from test.' })
    });
    assert.equal(contactUnconfigured.status, 503);

    const checkoutMissing = await fetch(`${baseUrl}/api/checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 'not-real' })
    });
    assert.equal(checkoutMissing.status, 404);

    const checkoutUnconfigured = await fetch(`${baseUrl}/api/checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: json.categories[0].items[0].id })
    });
    assert.equal(checkoutUnconfigured.status, 503);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
