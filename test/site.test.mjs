import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('catalog satisfies Fairchild spec minimums', async () => {
  const catalog = JSON.parse(
    await fs.readFile(path.join(rootDir, 'data', 'fairchild.json'), 'utf8')
  );

  assert.equal(catalog.brand.name, 'Fairchild Alchemy');
  assert.equal(catalog.categories.length, 4);

  const totalItems = catalog.categories.reduce((sum, category) => sum + category.items.length, 0);
  assert.ok(totalItems >= 24);
  assert.ok(catalog.about.includes('Nothing ships in plastic'));
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
    assert.match(await home.text(), /Fairchild Alchemy/);

    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: 'fairchildalchemy-app' });

    const data = await fetch(`${baseUrl}/data/fairchild.json`);
    assert.equal(data.status, 200);
    const json = await data.json();
    assert.equal(json.categories[0].id, '3d-printed');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

