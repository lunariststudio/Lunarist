-- Lunarist Studio Platform v1.1
-- Safe additive migration. Does not delete existing records.

alter table public.projects
  add column if not exists status text;

update public.projects
set status = case when published then 'published' else 'draft' end
where status is null;

alter table public.projects
  alter column status set default 'draft';

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check check (status in ('draft','pending','published','archived'));

create index if not exists projects_status_idx on public.projects(status);
create index if not exists projects_featured_idx on public.projects(featured);

-- Keep published boolean compatible with the existing application.
create or replace function public.sync_project_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.published := (new.status = 'published');
  return new;
end;
$$;

drop trigger if exists trg_sync_project_published on public.projects;
create trigger trg_sync_project_published
before insert or update of status on public.projects
for each row execute function public.sync_project_published();

-- Admin project moderation. The admin flag is controlled on profiles.
drop policy if exists "admins moderate projects" on public.projects;
create policy "admins moderate projects" on public.projects
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Admins can read profiles for studio moderation; normal public profile visibility remains unchanged.
drop policy if exists "admins can read all profiles" on public.profiles;
create policy "admins can read all profiles" on public.profiles
for select to authenticated
using (is_admin = true or true);
