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
}

assert.equal(catalog.categories.length, 4, 'Expected exactly four categories');

const totalItems = catalog.categories.reduce((sum, category) => sum + category.items.length, 0);
assert.ok(totalItems >= 24, 'Expected at least 24 products');

for (const category of catalog.categories) {
  assert.ok(category.items.length >= 6, `${category.id} needs at least six items`);
  for (const item of category.items) {
    assert.match(item.image_url, /^https:\/\/images\.pexels\.com\/photos\/\d+\/pexels-photo-\d+\.jpeg\?auto=compress&cs=tinysrgb&w=940$/);
    assert.ok(item.price >= 15 && item.price <= 120, `${item.name} price out of range`);
  }
}

console.log(`Audit passed: ${totalItems} products across ${catalog.categories.length} categories.`);

