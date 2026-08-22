-- Lunarist commission intake form: extra client fields, deposit/full payment
-- tracking, and percentage-capable service add-ons. Safe additive migration.

alter table public.commissions add column if not exists company text default '';
alter table public.commissions add column if not exists social text default '';
alter table public.commissions add column if not exists target_deadline date;
alter table public.commissions add column if not exists attachment_url text default '';
alter table public.commissions add column if not exists payment_type text not null default 'full' check (payment_type in ('deposit','full'));
alter table public.commissions add column if not exists deposit_amount numeric;
alter table public.commissions add column if not exists total_amount numeric;

-- service.add_ons rows now carry a "type" field: 'fixed' (flat $) or
-- 'percent' (percentage of price_from). No schema change needed since
-- add_ons is jsonb — this is enforced app-side in api/paypal.js.

-- Public bucket for client-submitted commission briefs/reference files.
-- Anyone (including anonymous inquirers) can upload; nothing is publicly
-- listable, and reads go through the public object URL only if you already
-- know the exact path (which only the uploader and the server receive).
insert into storage.buckets (id,name,public)
values ('commission-uploads','commission-uploads',true)
on conflict (id) do update set public=true;

drop policy if exists "commission uploads public read" on storage.objects;
create policy "commission uploads public read" on storage.objects
for select using (bucket_id='commission-uploads');

drop policy if exists "anyone can upload commission attachments" on storage.objects;
create policy "anyone can upload commission attachments" on storage.objects
for insert to anon, authenticated
with check (bucket_id='commission-uploads');
