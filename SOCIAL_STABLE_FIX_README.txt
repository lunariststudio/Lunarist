Lunarist social stable fix

X:
- Usage/credit exhaustion no longer blocks project creation.
- On quota/usage errors the API returns a usable project payload with
  metricsUnavailable=true instead of throwing "credits depleted".
- When API access works, public_metrics are mapped to views/likes/replies/reposts.
- Never displays unavailable X metrics as fake zeroes.
- The original X URL is preserved and the embed URL is x.com/i/status/<id>.
- X API credits must be restored for live X metrics; code cannot bypass X billing/usage caps.

Instagram:
- Uses INSTAGRAM_ACCESS_TOKEN directly.
- Does not pretend META_APP_ID/META_APP_SECRET are a substitute token.
- Uses Meta Instagram oEmbed for public post/reel embedding metadata.
- Code 190 is returned as a clear authentication problem rather than repeatedly
  trying incompatible app-token fallbacks.
- Instagram metrics are null when not supplied by the endpoint; they are not
  falsely reported as zero.

Vercel:
X_BEARER_TOKEN
INSTAGRAM_ACCESS_TOKEN
META_APP_ID (optional app configuration)
META_APP_SECRET (optional app configuration)
