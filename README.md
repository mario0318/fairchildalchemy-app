# Fairchild Alchemy

Standalone Cloud Run storefront for `fairchildalchemy.com`.

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

## Domain

This app is intended to serve `fairchildalchemy.com` from its own Cloud Run service:

- Service: `fairchildalchemy-app`
- Region: `us-central1`
- Domain mapping: `fairchildalchemy.com` and `www.fairchildalchemy.com`
