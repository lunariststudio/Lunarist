Lunarist Twitch integration

Base:
Lunarist(9).zip

Added:
- api/twitch.js
- twitch-autofill.js

Vercel environment variables required:
- TWITCH_CLIENT_ID
- TWITCH_CLIENT_SECRET

Supported:
- Twitch channel URLs
- Twitch live channel data
- Twitch VOD URLs

The Twitch client secret is server-side only.

Important:
The base index.html is preserved exactly from Lunarist(9).zip. The standalone
twitch-autofill.js helper is included so the existing project form can be wired
without overwriting the base UI. Add:
<script src="/twitch-autofill.js"></script>
to index.html if the current form does not already load it.
