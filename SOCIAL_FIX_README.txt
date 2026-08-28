Lunarist X + Instagram full fix

X:
- Requests public_metrics including impression_count and like_count.
- Maps metrics into views/likes/replies/reposts.
- Does not iframe x.com directly; frontend helper normalizes the post URL for an embed/card implementation.
- Requires X_BEARER_TOKEN with sufficient X API access. If the account is out of credits/usage, metrics cannot be recovered by code.

Instagram:
- Cleans the configured INSTAGRAM_ACCESS_TOKEN.
- Uses Instagram oEmbed through Meta as a public-post fallback.
- Does NOT treat META_APP_ID/META_APP_SECRET as a substitute for a user/content access token.
- Returns actionable token/permission errors.

Vercel:
X_BEARER_TOKEN
INSTAGRAM_ACCESS_TOKEN
META_APP_ID (optional, for app configuration)
META_APP_SECRET (optional, for app configuration)
