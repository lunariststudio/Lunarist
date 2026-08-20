-- Lunarist Studio Platform v1.1 - Phase 2 Project Management
-- Members can create/edit drafts and submit projects for review.
-- Only admins can publish/archive/feature projects.

alter table public.projects
  alter column status set default 'draft';

update public.projects
set status = case when published then 'published' else coalesce(status, 'draft') end
where status is null or status not in ('draft','pending','published','archived');

-- Keep the legacy published flag synchronized with the workflow status.
create or replace function public.sync_project_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.published := (new.status = 'published');
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists trg_sync_project_published on public.projects;
create trigger trg_sync_project_published
before insert or update of status on public.projects
for each row execute function public.sync_project_published();

-- Replace broad member update access with workflow-aware access.
drop policy if exists "members update their own projects" on public.projects;
create policy "members update their own projects"
on public.projects
for update to authenticated
using (
  owner_id = (select auth.uid())
)
with check (
  owner_id = (select auth.uid())
  and status in ('draft','pending')
);

-- Admins retain full moderation control.
drop policy if exists "admins moderate projects" on public.projects;
create policy "admins moderate projects"
on public.projects
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_admin = true
  )
);

-- Public users may only see published projects; owners may see their own drafts/pending work.
drop policy if exists "published projects are public" on public.projects;
create policy "published projects are public"
on public.projects
for select
using (
  published = true
  or owner_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_admin = true
  )
);

create index if not exists projects_owner_status_idx
  on public.projects(owner_id, status, updated_at desc);

create index if not exists projects_public_feed_idx
  on public.projects(status, created_at desc)
  where published = true;

-- Keep the designated Studio account an admin on first signup as well as for existing accounts.
create or replace function public.lunarist_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  requested_display text;
  base_username text;
  final_username text;
  suffix text;
  admin_account boolean;
begin
  requested_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username',''), '[^a-z0-9_]', '', 'g'));
  requested_username := left(requested_username, 32);
  requested_display := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name','')), '');
  admin_account := lower(coalesce(new.email, '')) = 'lunariststudio@gmail.com';

  if requested_username = '' then
    base_username := lower(regexp_replace(split_part(coalesce(new.email,'member'), '@', 1), '[^a-z0-9_]', '', 'g'));
    base_username := left(coalesce(nullif(base_username,''),'member'), 24);
    suffix := lower(replace(left(new.id::text, 8), '-', ''));
    final_username := left(base_username || '_' || suffix, 32);
  else
    final_username := requested_username;
  end if;

  if exists (select 1 from public.profiles where username = final_username and id <> new.id) then
    final_username := left(final_username, 23) || '_' || lower(replace(left(new.id::text, 8), '-', ''));
  end if;

  insert into public.profiles (id, username, display_name, role, bio, skills, available, is_admin)
  values (
    new.id,
    final_username,
    coalesce(requested_display, nullif(split_part(coalesce(new.email,'Lunarist member'), '@', 1), ''), 'Lunarist member'),
    case when admin_account then 'Administrator' else '' end,
    '', '{}', true, admin_account
  )
  on conflict (id) do update
    set is_admin = public.profiles.is_admin or excluded.is_admin,
        role = case when excluded.is_admin then 'Administrator' else public.profiles.role end,
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.lunarist_create_profile() from public, anon, authenticated;
grant execute on function public.lunarist_create_profile() to postgres;

-- Make the requested Lunarist Studio account an admin if it already exists.
update public.profiles p
set is_admin = true,
    role = case when coalesce(nullif(trim(p.role), ''), '') = '' then 'Administrator' else p.role end,
    updated_at = now()
from auth.users u
where u.id = p.id
  and lower(u.email) = 'lunariststudio@gmail.com';
