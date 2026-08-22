-- Lunarist Studio Phase 3 completion
-- Safe additive admin features.

alter table public.commissions
  add column if not exists admin_notes text default '';

create index if not exists commissions_status_created_idx
  on public.commissions(status, created_at desc);

-- Admins may manage all commissions.
drop policy if exists "admins manage commissions" on public.commissions;
create policy "admins manage commissions" on public.commissions
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true));

-- Studio settings remain admin-only.
drop policy if exists "admins manage studio settings" on public.studio_settings;
create policy "admins manage studio settings" on public.studio_settings
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true));
