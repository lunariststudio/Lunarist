Lunarist — Instagram + X automatic project fetch

This package is based on the full uploaded Lunarist Studio ZIP.

Frontend:
- index.html updated to automatically detect YouTube, Instagram and X/Twitter URLs in New Project.
- Automatically fetches metadata and fills title, description, thumbnail, media URL and media type.
- Shows fetched X metrics (views, likes, reposts) when provided by the API.
- Keeps the existing YouTube live URL handling.

API:
- api/youtube.js is the exact API file from the uploaded ZIP and already handles:
  YouTube
  X / Twitter
  Instagram

Vercel environment variables:
- YOUTUBE_API_KEY
- X_BEARER_TOKEN
- INSTAGRAM_ACCESS_TOKEN

Push these two files to the matching paths in your repository.
