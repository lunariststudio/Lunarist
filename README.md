# Lunarist Studio — Creative Network Prototype

This is a rebuilt Lunarist Studio web app based on the interaction direction of the supplied Yujin portfolio, redesigned as a multi-member creative network.

## Included
- Algorithmic / personalized Home feed
- Discover page with search + filters
- Artist directory and individual member profiles
- Project detail modal with video/image presentation
- Guest personalization using anonymous local session data
- Like / view signals that change recommendations
- Member dashboard drawer
- Profile editing prototype
- Project management area ready to connect to Supabase
- Responsive mobile UI
- Supabase is wired to the production project using a publishable browser key (safe for public clients; RLS remains the security boundary).

## Production architecture
The included UI is intentionally runnable without a backend so it can be previewed immediately. The browser app reads published profiles/projects from the connected Supabase project and records anonymous discovery events. RLS protects member writes and keeps event reads private.

Suggested tables are in `supabase/schema.sql`.

## Run
Open `index.html` directly for a static preview, or serve the folder with any static server.

## Production wiring
- Supabase project: `xouvmwjssngrbnsumrnz` (ap-southeast-1)
- Vercel project: `lunarist`
- GitHub: `lunariststudio/Lunarist`
- Frontend reads `profiles` and published `projects` from Supabase.
- Discovery events are inserted into `discovery_events`.
- RLS allows public published reads, authenticated owner writes, and anonymous event inserts.
- `public.rls_auto_enable()` is not executable by API roles.
