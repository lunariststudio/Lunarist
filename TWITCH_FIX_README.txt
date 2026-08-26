Lunarist Twitch metrics/thumbnail fix

Fixed:
- Twitch VOD thumbnail URLs now replace Twitch's {width}/{height} placeholders
  with 1280x720 so the thumbnail can render.
- Fetched Twitch VOD view_count is stored as the project's initial views for
  newly created projects.
- Existing projects keep their Lunarist view/like counters when edited.
- Twitch does not expose a native like/favorite count through Helix, so
  Lunarist likes remain the project's own likes counter.
- The New Project fetch status explicitly explains the Twitch like limitation.

Vercel variables:
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
