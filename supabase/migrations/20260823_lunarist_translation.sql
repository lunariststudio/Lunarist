-- Japanese translations for custom artist TOS and commission briefs.
alter table public.profiles add column if not exists tos_ja text default '';
alter table public.commissions add column if not exists message_ja text default '';
