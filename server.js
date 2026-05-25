import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTACT_SUBJECT_TAG = '[FAIRCHILD ALCHEMY CONTACT]';
const STRIPE_BRANDING_VERSION = '2025-09-30.clover';
const CHECKOUT_BRANDING = {
  backgroundColor: '#050807',
  buttonColor: '#d5a852',
  displayName: 'Fairchild Alchemy',
  fontFamily: 'inconsolata',
  borderStyle: 'rectangular'
};

function sanitize(value = '') {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

async function sendContactEmail(entry) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL || process.env.MAIL_REPLY_TO;
  const fromAddress = process.env.CONTACT_FROM_EMAIL || process.env.MAIL_FROM_ADDRESS;
  const fromName = process.env.CONTACT_FROM_NAME || 'Fairchild Alchemy';

  if (!apiKey || !to || !fromAddress) {
    return { sent: false, reason: 'contact email delivery is not configured' };
  }

  const subject = `${CONTACT_SUBJECT_TAG} ${entry.name || entry.email}`;
  const text = [
    subject,
    '',
    `From: ${entry.name || 'Unknown'} <${entry.email}>`,
    `Sent: ${entry.ts}`,
    '',
    entry.message
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      reply_to: entry.email,
      subject,
      text
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`contact email provider rejected the message: ${response.status} ${detail}`.trim());
  }

  return { sent: true };
}

function getCatalogItem(productId) {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'fairchild.json'), 'utf8'));
  for (const category of catalog.categories || []) {
    const item = (category.items || []).find(product => product.id === productId);
    if (item) return { item, category };
  }
  return null;
}

function appendBrandingParams(params) {
  params.set('branding_settings[display_name]', CHECKOUT_BRANDING.displayName);
  params.set('branding_settings[font_family]', CHECKOUT_BRANDING.fontFamily);
  params.set('branding_settings[border_style]', CHECKOUT_BRANDING.borderStyle);
  params.set('branding_settings[background_color]', CHECKOUT_BRANDING.backgroundColor);
  params.set('branding_settings[button_color]', CHECKOUT_BRANDING.buttonColor);

  const logo = process.env.STRIPE_CHECKOUT_LOGO_FILE;
  const icon = process.env.STRIPE_CHECKOUT_ICON_FILE;
  if (logo) {
    params.set('branding_settings[logo][type]', 'file');
    params.set('branding_settings[logo][file]', logo);
  }
  if (icon) {
    params.set('branding_settings[icon][type]', 'file');
    params.set('branding_settings[icon][file]', icon);
  }
}

async function createCheckoutSession(req, item, category) {
  const apiKey = process.env.STRIPE_SECRET || process.env.STRIPE_SECRET_KEY;
  if (!apiKey) return { ok: false, status: 503, error: 'Stripe checkout is not configured.' };
  if (!item.stripe_price_id) return { ok: false, status: 400, error: 'This item is missing a Stripe price.' };

  const siteUrl = process.env.FAIRCHILD_SITE_URL || `${req.protocol}://${req.get('host')}`;
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': item.stripe_price_id,
    'line_items[0][quantity]': '1',
    'payment_method_types[0]': 'card',
    'phone_number_collection[enabled]': 'true',
    'shipping_address_collection[allowed_countries][0]': 'US',
    client_reference_id: item.id,
    success_url: `${siteUrl}/?checkout=complete&item=${encodeURIComponent(item.id)}`,
    cancel_url: `${siteUrl}/#collection`,
    'metadata[fairchild_item_id]': item.id,
    'metadata[fairchild_category]': category.id,
    'payment_intent_data[metadata][fairchild_item_id]': item.id,
    'payment_intent_data[metadata][fairchild_category]': category.id
  });
  appendBrandingParams(params);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_BRANDING_VERSION
    },
    body: params
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || 'Stripe checkout session creation failed.';
    throw new Error(message);
  }

  return { ok: true, id: json.id, url: json.url };
}

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

  app.post('/api/contact', async (req, res) => {
    const entry = {
      ts: new Date().toISOString(),
      name: sanitize(req.body?.name),
      email: sanitize(req.body?.email),
      message: sanitize(req.body?.message)
    };

    if (!entry.email || !entry.message) {
      return res.status(400).json({ ok: false, error: 'Email and message are required.' });
    }

    try {
      const delivery = await sendContactEmail(entry);
      console.log('[CONTACT]', JSON.stringify({ ...entry, subject_tag: CONTACT_SUBJECT_TAG, delivery }));
      if (!delivery.sent) return res.status(503).json({ ok: false, error: delivery.reason });
      res.json({ ok: true });
    } catch (error) {
      console.error('[CONTACT_ERROR]', error);
      res.status(502).json({ ok: false, error: 'Message delivery failed.' });
    }
  });

  app.post('/api/checkout-session', async (req, res) => {
    const productId = sanitize(req.body?.product_id);
    const match = getCatalogItem(productId);
    if (!match) return res.status(404).json({ ok: false, error: 'Product not found.' });

    try {
      const session = await createCheckoutSession(req, match.item, match.category);
      if (!session.ok) return res.status(session.status).json({ ok: false, error: session.error });
      res.json({ ok: true, url: session.url, id: session.id });
    } catch (error) {
      console.error('[CHECKOUT_ERROR]', error);
      res.status(502).json({ ok: false, error: 'Unable to start branded checkout.' });
    }
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
