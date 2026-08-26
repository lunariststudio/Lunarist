Lunarist YouTube Live Fix

Replace these files in your Lunarist project:
  index.html
  api/youtube.js

Fixes:
- Accepts youtube.com/live/VIDEO_ID URLs including ?si= parameters.
- Fetches YouTube statistics for live videos.
- Returns normalized likeCount/likes values.
- Syncs YouTube viewCount and likeCount into the Lunarist project's views/likes fields.
- Keeps normal watch/embed/shorts/youtu.be URLs working.

After replacing the files, commit and push to main. Vercel should deploy automatically.


Instagram Vercel variables:
- INSTAGRAM_ACCESS_TOKEN
- META_APP_ID (optional fallback)
- META_APP_SECRET (optional fallback)
