# Eugene Card ↔ Lunarist Studio integration

This integration uses Lunarist's existing Supabase project as the source of truth for Lunarist accounts and stores a public Eugene Card URL on `public.profiles.eugene_card_url`.

For full shared identity/SSO, the two Supabase projects must either share authentication or use a server-side identity mapping. The current client-side integration intentionally does not copy credentials or private data between projects.
