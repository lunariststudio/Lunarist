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
- No hard-coded Supabase credentials

## Production architecture
The included UI is intentionally runnable without a backend so it can be previewed immediately. For production, connect the member/project/event models to Supabase and enforce permissions with Row Level Security.

Suggested tables are in `supabase/schema.sql`.

## Run
Open `index.html` directly for a static preview, or serve the folder with any static server.

## Suggested next step
Move the prototype to Next.js App Router + Supabase Auth/Storage/Postgres. Use authenticated member ownership for project writes, public read policies for published projects, and server-side event aggregation for recommendation scores.
