# Lunarist Studio — Vercel-ready

Lunarist is a static Vercel frontend backed by Supabase through server-side Vercel Functions.

## Environment variables

Create `.env.local` for local development (never commit it):

```env
SUPABASE_URL=https://xouvmwjssngrbnsumrnz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

On Vercel, add the same variables under **Project → Settings → Environment Variables** for Production, Preview, and Development as needed.

**Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.** The browser talks only to `/api/lunarist`.

Optional integrations:
- `YOUTUBE_API_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

## Behavior without env vars

The UI still renders using its local demo dataset; Supabase-backed loading/events are disabled gracefully instead of crashing.

## Deploy

This repository is Vercel-compatible as-is. No build command is required because the main UI is `index.html` and API endpoints live in `/api`.

Supabase schema and RLS policies are in `supabase/schema.sql`.
