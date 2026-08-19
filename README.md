# Lunarist Studio — Vercel + Supabase

This is the production-ready packaging of the Lunarist Studio web app.

## Architecture

- `public/index.html` — complete Lunarist client UI.
- `api/lunarist.js` — server-side Supabase proxy. The service-role key never reaches the browser.
- `api/youtube.js` — optional server-side YouTube metadata endpoint.
- `api/paypal.js` — optional server-side PayPal order endpoint.
- `supabase/schema.sql` — database/RLS schema.
- `vercel.json` — Vercel headers.
- `.env.example` — required environment variable template.

## Vercel

Set these Environment Variables in the Vercel project:

```text
SUPABASE_URL=https://xouvmwjssngrbnsumrnz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service-role key>
```

Optional:

```text
YOUTUBE_API_KEY=<Google YouTube Data API v3 key>
PAYPAL_CLIENT_ID=<PayPal client id>
PAYPAL_CLIENT_SECRET=<PayPal client secret>
```

Do NOT use `NEXT_PUBLIC_` for the service-role key.

## Local

```bash
cp .env.example .env.local
npm install
npx vercel dev
```

The site is static and the API functions run as Vercel serverless functions.

## Supabase

The existing Lunarist Supabase project should be used. Run the schema only when creating/migrating tables; do not blindly reseed production data.

The schema includes RLS for profiles/projects and private discovery-event reads.

## Important

This package preserves the supplied Lunarist UI and API structure. It does not pretend to contain source files that were not present in the uploaded archive. The supplied archive itself was a static HTML app, so this is the complete production packaging possible from that source.

## Fix 2026-08-20
Fixed a production crash caused by legacy browser `lunarist_session` data missing `interests`. The feed now normalizes old sessions and tolerates incomplete project/member records.
