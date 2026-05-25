# Fairchild Alchemy Launch Notes

Date: 2026-04-01

## Delivered

- Standalone app directory at `C:\Projects\fairchildalchemy-app`
- Dedicated Cloud Run service: `fairchildalchemy-app`
- Dedicated domain mappings:
  - `fairchildalchemy.com`
  - `www.fairchildalchemy.com`
- New GitHub repo: `https://github.com/mario0318/fairchildalchemy-app`
- Custom favicon system:
  - `public/favicon.svg`
  - `public/favicon-32x32.png`
  - `public/favicon-192x192.png`
  - `public/favicon-512x512.png`
  - `public/apple-touch-icon.png`

## Product Spec Coverage

- Four catalog sections:
  - `3D Printed Forms`
  - `Handmade Objects`
  - `Art & Print`
  - `Curiosities`
- 24 products total
- All product images use live Pexels CDN URLs
- About copy and contact section included per spec
- Product interactions currently show `arriving soon` until Stripe price IDs are real

## Validation

- `npm test` passed
- `npm run audit` passed
- 24 of 24 Pexels image URLs returned HTTP 200 on HEAD checks
- Cloud Run service URL responded with the live storefront content:
  - `https://fairchildalchemy-app-k744dycgta-uc.a.run.app`

## Cloud Run State

- Project: `sprime-app`
- Region: `us-central1`
- Service URL:
  - `https://fairchildalchemy-app-k744dycgta-uc.a.run.app`
- Domain route target:
  - `fairchildalchemy.com -> fairchildalchemy-app`
  - `www.fairchildalchemy.com -> fairchildalchemy-app`

## Notes

- The Fairchild domain was previously mapped to `mario0318-site`.
- The mapping objects were deleted and recreated so the domain now points to the standalone Fairchild service instead of the Mario container.
