import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const source = path.join(publicDir, 'favicon.svg');

const sizes = [
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-192x192.png', size: 192 },
  { name: 'favicon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }
];

await Promise.all(
  sizes.map(({ name, size }) =>
    sharp(source)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, name))
  )
);

console.log(`Generated ${sizes.length} favicon assets from favicon.svg`);

