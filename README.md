# Fairchild Alchemy

Standalone Cloud Run storefront for `fairchildalchemy.com`. Premium handmade objects, artisan curiosities, and things that resist disposal.

## Stack

- **Runtime**: Node.js + Express, served as a Cloud Run service
- **Frontend**: Vanilla ES module JS, Cormorant Garamond + Syne Mono, no build step
- **Catalog**: `/data/fairchild.json` — single source of truth for all products
- **Payments**: Stripe Payment Links, one per product, injected into the catalog JSON
- **Interest capture**: `POST /api/interest` — logs name/email/note to stdout; swap for DB or email provider in production
- **Contact form**: `POST /api/contact` — sends tagged messages through Resend when `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL` are configured
- **Branded checkout**: `POST /api/checkout-session` — creates a Stripe Checkout Session with Fairchild Alchemy branding and falls back to product Payment Links client-side
- **Public policies**: homepage includes visible contact, shipping, returns, refund/dispute, cancellation, restriction, and promotion terms for Stripe website review

## Catalog structure (`data/fairchild.json`)

Each item carries:

| Field | Description |
|---|---|
| `id` | Slug, matches Stripe metadata |
| `name` / `short_description` / `long_description` | Copy tiers for card vs modal |
| `price` | Numeric USD, used for display (Stripe is source of truth for charge) |
| `units_total` / `units_available` | `null` = open stock; integer = limited edition |
| `status` | `"available"` or `"limited"` |
| `materials` / `dimensions` / `care` | Spec sheet fields rendered in modal |
| `image_urls` | Array — supports multi-image carousel (2–3 per item) |
| `generation_seed` | AI image generation metadata: model, numeric seed, full prompt, angle variants |
| `stripe_payment_link` | Live `buy.stripe.com` URL — null until Stripe is configured |

### Categories

| ID | Name | Symbol | Character |
|---|---|---|---|
| `sanctum` | The Sanctum | ☿ | Limited artisan, 2–5 units, $265–$620 |
| `study` | The Study | ⊞ | Premium desk objects, open stock, $68–$149 |
| `ritual` | Ritual Objects | ⌘ | Living objects for daily use, $46–$165 |
| `library` | The Library | ☽ | Objects for the mind, $52–$88 |

## AI generation seeds

Every product carries a `generation_seed` object usable with Midjourney v6, DALL·E 3, or Stable Diffusion XL:

```json
{
  "model": "Midjourney v6 · DALL·E 3 · Stable Diffusion XL",
  "prompt": "studio product photography, ...",
  "seed": 847291,
  "angle_variants": [
    "same composition 3/4 view rotated 45° clockwise",
    "blue-tinted dim room nighttime shelf display",
    "overhead bird's-eye on white Carrara marble"
  ]
}
```

The seed is exposed in the product modal UI with a copy button. Angle variants describe lighting/setting/POV alternatives for generating additional images of the same object.

## Stripe setup

Payment links live in `data/fairchild.json` as `buy.stripe.com/...` URLs. Before launch, verify the connected Stripe account and organization in the Stripe dashboard match Fairchild Alchemy; do not assume the local connector account is the production organization.

To add a new product:
1. Create product + price in Stripe dashboard or via MCP
2. Create payment link
3. Add item to `data/fairchild.json` with `stripe_payment_link` set to the `buy.stripe.com` URL
4. Deploy

To update a price: create a new Stripe price, new payment link, update JSON, deploy.

## Claim / interest flow

- **Express Interest tab**: collects name, email, optional note → `POST /api/interest` → server logs to stdout → card state persists as "Interest Noted ✓" in `localStorage`
- **Claim & Pay tab**: links to live Stripe checkout → on click, card state persists as "Claimed ✓" in `localStorage`

State is per-browser, per-device. For server-side tracking, wire `/api/interest` to a database or email service (Resend, Postmark, etc.).

## Contact delivery

Contact form messages use the subject prefix `[FAIRCHILD ALCHEMY CONTACT]`. Configure Cloud Run with:

```bash
RESEND_API_KEY=<secret>
CONTACT_TO_EMAIL=<recipient>
CONTACT_FROM_EMAIL=<verified sender>
CONTACT_FROM_NAME="Fairchild Alchemy"
```

Branded checkout sessions require:

```bash
STRIPE_SECRET=<secret>
FAIRCHILD_SITE_URL=https://fairchildalchemy.com
STRIPE_CHECKOUT_LOGO_FILE=<Stripe business_logo file id>
STRIPE_CHECKOUT_ICON_FILE=<Stripe business_icon file id>
```

Checkout Sessions collect card payment, US shipping address, and phone number for physical-goods fulfillment.

## Image serving

Product images are local generated product photos under `public/images/thumb-sources/` and are referenced directly by `image_urls`. The framed JPG files in `public/images/` are legacy card renders; the storefront uses the cleaner source product photos so the objects read as real merchandise instead of poster art.

To generate new product photos:

```bash
python scripts/gen_images.py --force
```

To regenerate legacy framed card renders from those source assets:

```bash
python scripts/make_thumbs.py
```

## Local run

```bash
npm install
npm run generate:favicon
npm start
```

## Checks

```bash
npm test
npm run audit
```

## Deploy

```bash
gcloud builds submit --config cloudbuild.yaml
```

## Infrastructure

- **Service**: `fairchildalchemy-app`
- **Region**: `us-central1`
- **Domain**: `fairchildalchemy.com` and `www.fairchildalchemy.com`
- **CSP**: allows `picsum.photos` (images), `js.stripe.com` (scripts), `api.stripe.com` (connect)
