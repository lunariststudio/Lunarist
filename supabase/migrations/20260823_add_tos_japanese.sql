-- Cache Japanese DeepL translations of artist custom Terms of Service.
-- The English TOS remains the source of truth; tos_ja is regenerated when English TOS changes.
alter table public.profiles
  add column if not exists tos_ja text;
