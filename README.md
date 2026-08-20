# Lunarist Studio — production vNext

## What changed
- One canonical `index.html` at the Vercel root; removed duplicate `public/index.html`.
- Supabase is now the production source of truth. There is no demo-data fallback.
- Added Supabase Auth: sign up, sign in, sign out, session restore.
- Added real profile editing through Supabase + RLS.
- Added real project create/edit/delete/publish through Supabase + RLS.
- Added `/api/config` to expose only the public Supabase URL and anon/publishable key.
- Service-role key remains server-only.
- Discovery events remain server-side.
- Removed demo seed inserts from `supabase/schema.sql`; existing production data is not overwritten by the schema.
- Added optional Storage migration for `project-media`.

## Vercel Environment Variables
Required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (safe to expose to the browser via `/api/config`)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Optional YouTube/PayPal variables remain supported.

## Supabase
Run `supabase/schema.sql` only for missing base tables/policies. Run `supabase/migrations/20260821_lunarist_storage.sql` once if you want the `project-media` storage bucket. Do not use the old demo-seeding version.

## Project media
The project editor currently accepts media URLs. The storage migration prepares a secure per-user bucket for the next upload step without exposing service credentials.

## Platform v1.1

Added:
- Four-state project lifecycle: `draft`, `pending`, `published`, `archived`
- Admin Studio project moderation and featured curation
- Admin moderation policy enforced by Supabase RLS
- Weighted recommendation scoring: interest 40%, tags 20%, trending 15%, freshness 10%, artist affinity 10%, exploration 5%
- Safe additive migration: `supabase/migrations/20260821_lunarist_v11.sql`

Set `profiles.is_admin = true` manually for trusted Studio administrators. Do not expose service-role credentials in browser code.

## Platform v1.2

- Real Supabase Storage bucket: `project-media`
- Authenticated owner-scoped uploads/updates/deletes
- Public project-media reads
- Project thumbnail/media file inputs wired into the project save flow
- Admin Studio discovery-event summary

## Platform v1.3 — Admin Studio

- Studio overview KPIs: members, projects, pending, published, discovery events
- Pending/moderation queue
- Featured project curation visibility
- Member directory with admin/availability status
- Discovery event breakdown
- Additional database indexes for Studio queries

## Phase 3 — Project Management

Phase 2 adds the real member project workflow:

- Create and edit projects from Member Space.
- Save as `draft`.
- Submit as `pending` for Studio review.
- Only admins can publish or archive projects.
- Upload thumbnails and media to the `project-media` Supabase Storage bucket.
- Owner-scoped Storage paths use `<user-id>/<uuid>-...`.
- Public discovery only exposes published projects.
- `lunariststudio@gmail.com` is promoted to admin by the Phase 2 migration when that Auth user exists.

Apply `supabase/migrations/20260821_lunarist_phase2_projects.sql` to the Lunarist Supabase project before deploying.


## Phase 3 — Admin Studio

The Studio account `lunariststudio@gmail.com` can moderate project status, feature/unfeature projects, inspect members, view private discovery analytics, and edit protected Studio settings.

Apply `supabase/migrations/20260821_lunarist_phase3_admin_studio.sql` after the Phase 1 and Phase 2 migrations.

The admin flag is protected against self-escalation; ordinary members cannot promote themselves to admin through profile updates.

## Phase 4 — Real Recommendation Backend

Phase 4 replaces the browser-only recommendation score with a server-side Supabase recommendation function.

Scoring weights:
- Interest match: 40%
- Tag match: 20%
- Trending: 15%
- Freshness: 10%
- Artist affinity: 10%
- Exploration: 5%

The frontend keeps a stable anonymous discovery session in localStorage and sends sanitized discovery events to the existing `/api/lunarist` endpoint. The endpoint now exposes `resource=recommendations`, which calls the protected `public.get_recommendations()` RPC using the server-only Supabase service role.

Apply `supabase/migrations/20260821_lunarist_phase4_recommendations.sql` after the existing Phase 1–3 migrations.

The recommendation RPC excludes projects already seen in the visitor's session and uses deterministic per-session exploration, so two visitors can receive different recommendations without relying on browser-side random ranking.
