-- Lunarist Studio — Services, and linking services to portfolio projects
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text default '',
  category text not null,
  tags text[] default '{}',
  price_from text default '',
  delivery_time text default '',
  thumbnail_url text,
  status text default 'draft' check (status in ('draft','pending','published','archived')),
  published boolean default false,
  featured boolean default false,
  views bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Many-to-many: a service can showcase several portfolio projects as examples,
-- and a project can be referenced by more than one service.
create table if not exists public.service_projects (
  service_id uuid not null references public.services(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (service_id, project_id)
);

create index if not exists services_owner_idx on public.services(owner_id);
create index if not exists services_category_idx on public.services(category);
create index if not exists services_published_idx on public.services(published);
create index if not exists service_projects_project_idx on public.service_projects(project_id);

alter table public.services enable row level security;
alter table public.service_projects enable row level security;

drop policy if exists "published services are public" on public.services;
create policy "published services are public" on public.services
for select using (published = true or owner_id = auth.uid());

-- Only Lunarist Members and Administrators may create services (mirrors projects).
drop policy if exists "members create their own services" on public.services;
create policy "members create their own services" on public.services
for insert to authenticated with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.account_type = 'member' or p.is_admin = true)
  )
);

drop policy if exists "members update their own services" on public.services;
create policy "members update their own services" on public.services
for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "members delete their own services" on public.services;
create policy "members delete their own services" on public.services
for delete to authenticated using (owner_id = auth.uid());

-- service_projects visibility follows the service's own visibility.
drop policy if exists "service links are visible with their service" on public.service_projects;
create policy "service links are visible with their service" on public.service_projects
for select using (
  exists (select 1 from public.services s where s.id = service_id and (s.published = true or s.owner_id = auth.uid()))
);

-- Only someone who owns BOTH the service and the project may link them.
drop policy if exists "owners link their own service to their own project" on public.service_projects;
create policy "owners link their own service to their own project" on public.service_projects
for insert to authenticated with check (
  exists (select 1 from public.services s where s.id = service_id and s.owner_id = auth.uid())
  and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
);

drop policy if exists "owners unlink their own service links" on public.service_projects;
create policy "owners unlink their own service links" on public.service_projects
for delete to authenticated using (
  exists (select 1 from public.services s where s.id = service_id and s.owner_id = auth.uid())
);
