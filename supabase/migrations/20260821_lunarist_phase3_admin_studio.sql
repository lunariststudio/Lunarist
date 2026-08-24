-- Lunarist Studio Platform v1.3 - Phase 3 Admin Studio
-- Admin moderation, analytics, curation, and protected Studio settings.

create index if not exists discovery_events_type_created_idx
  on public.discovery_events(event_type, created_at desc);
create index if not exists projects_status_featured_updated_idx
  on public.projects(status, featured, updated_at desc);

-- Protect the admin flag from self-escalation. Admin promotion remains server/SQL controlled.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if not exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    ) then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;
create trigger trg_prevent_profile_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

-- Private admin check used by analytics/settings policies. It is not exposed through the Data API.
create schema if not exists private;
create or replace function private.is_lunarist_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_admin = true
  );
$$;
revoke all on function private.is_lunarist_admin() from public, anon, authenticated;
grant execute on function private.is_lunarist_admin() to authenticated;

-- Discovery analytics are private to Studio admins.
drop policy if exists "admins can read discovery events" on public.discovery_events;
create policy "admins can read discovery events"
on public.discovery_events
for select to authenticated
using ((select private.is_lunarist_admin()));

-- Admin-only Studio settings.
create table if not exists public.studio_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.studio_settings enable row level security;

drop policy if exists "admins can read studio settings" on public.studio_settings;
create policy "admins can read studio settings"
on public.studio_settings
for select to authenticated
using ((select private.is_lunarist_admin()));

drop policy if exists "admins can insert studio settings" on public.studio_settings;
create policy "admins can insert studio settings"
on public.studio_settings
for insert to authenticated
with check ((select private.is_lunarist_admin()) and updated_by = (select auth.uid()));

drop policy if exists "admins can update studio settings" on public.studio_settings;
create policy "admins can update studio settings"
on public.studio_settings
for update to authenticated
using ((select private.is_lunarist_admin()))
with check ((select private.is_lunarist_admin()) and updated_by = (select auth.uid()));

drop policy if exists "admins can delete studio settings" on public.studio_settings;
create policy "admins can delete studio settings"
on public.studio_settings
for delete to authenticated
using ((select private.is_lunarist_admin()));

insert into public.studio_settings(key,value)
values
  ('site_name','Lunarist Studio'),
  ('tagline','Unleash Your Dream.')
on conflict (key) do nothing;

-- Ensure the designated Studio account is an admin if it already exists.
update public.profiles p
set is_admin = true,
    role = case when coalesce(nullif(trim(p.role), ''), '') = '' then 'Administrator' else p.role end,
    updated_at = now()
from auth.users u
where u.id = p.id
  and lower(u.email) = 'lunariststudio@gmail.com';

-- Keep Data API permissions explicit for newly created tables.
grant select, insert, update, delete on public.studio_settings to authenticated;
