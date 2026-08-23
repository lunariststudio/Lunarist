Lunarist DeepL + fixed deployment package

Included Vercel API functions:
- api/config.js
- api/lunarist.js
- api/paypal.js
- api/youtube.js
- api/translate.js

Required Vercel environment variables:
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
DEEPL_API_KEY
Optional: DEEPL_API_URL
Optional: YOUTUBE_API_KEY

Run the included Supabase migration before saving Japanese TOS:
supabase/migrations/20260823_add_tos_japanese.sql

The Member Space no longer contains My Commissions; the standalone /commissions page remains the only commission dashboard entry.
