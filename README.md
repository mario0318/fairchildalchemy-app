# Fairchild Alchemy

Standalone Cloud Run storefront for `fairchildalchemy.com`. Premium handmade objects, artisan curiosities, and things that resist disposal.

## Stack

- **Runtime**: Node.js + Express, served as a Cloud Run service
- **Frontend**: Vanilla ES module JS, Cormorant Garamond + Syne Mono, no build step
- **Catalog**: `/data/fairchild.json` — single source of truth for all products
- **Payments**: Stripe Payment Links (live), one per product, injected into the catalog JSON
- **Interest capture**: `POST /api/interest` — logs name/email/note to stdout; swap for DB or email provider in production

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

All 15 products and prices are created in the connected Stripe account. Payment links are live at `buy.stripe.com/...`.

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

## Image serving

Product images currently use [Lorem Picsum](https://picsum.photos) with deterministic seeds (`/seed/{slug}/{w}/{h}`). Replace `image_urls` arrays per item with real product photography or AI-generated images using the provided `generation_seed` prompts.

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
