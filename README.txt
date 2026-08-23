Lunarist DeepL TOS / Inquire translation

1. Deploy index.html as your current Lunarist frontend.
2. Deploy api/translate.js as Vercel /api/translate.js.
3. Add Vercel environment variable:
   DEEPL_API_KEY=your_key_here
   Optional: DEEPL_API_URL=https://api.deepl.com/v2/translate
   For a DeepL Free key, the function automatically uses api-free.deepl.com when the key ends with :fx.
4. Run supabase/migrations/20260823_add_tos_japanese.sql.

The DeepL key is server-side only and is never placed in the HTML.
