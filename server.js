import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(express.json());

  // Interest form endpoint — stores to server-side log (swap for DB/email in production)
  app.post('/api/interest', (req, res) => {
    const { name, email, note, product_id, product_name } = req.body || {};
    if (!email || !product_id) return res.status(400).json({ ok: false, error: 'Missing required fields' });
    const entry = { ts: new Date().toISOString(), name, email, note, product_id, product_name };
    console.log('[INTEREST]', JSON.stringify(entry));
    res.json({ ok: true });
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://picsum.photos', 'https://fastly.picsum.photos'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'", 'https://js.stripe.com'],
          connectSrc: ["'self'", 'https://api.stripe.com'],
          frameSrc: ["'self'", 'https://js.stripe.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'", 'https://js.stripe.com'],
          upgradeInsecureRequests: []
        }
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })
  );

  app.use(
    express.static(path.join(__dirname, 'public'), {
      extensions: ['html']
    })
  );
  app.use('/data', express.static(path.join(__dirname, 'data')));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'fairchildalchemy-app' });
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

export function startServer(port = Number(process.env.PORT) || 8080) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`fairchildalchemy-app listening on ${port}`);
  });
}

if (process.argv[1] === __filename) {
  startServer();
}
