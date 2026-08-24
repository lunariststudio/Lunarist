create table if not exists public.saved_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index if not exists saved_projects_user_created_idx on public.saved_projects(user_id, created_at desc);

alter table public.saved_projects enable row level security;

drop policy if exists "Users can read own saved projects" on public.saved_projects;
create policy "Users can read own saved projects" on public.saved_projects for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can save projects" on public.saved_projects;
create policy "Users can save projects" on public.saved_projects for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can unsave projects" on public.saved_projects;
create policy "Users can unsave projects" on public.saved_projects for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.saved_projects to authenticated;
