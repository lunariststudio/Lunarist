-- Lunarist Studio production schema starter
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text default '',
  bio text default '',
  avatar_url text,
  banner_url text,
  skills text[] default '{}',
  socials jsonb default '{}'::jsonb,
  available boolean default true,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text unique,
  description text default '',
  category text not null,
  tags text[] default '{}',
  thumbnail_url text,
  media_url text,
  media_type text default 'image',
  published boolean default false,
  featured boolean default false,
  views bigint default 0,
  likes bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.discovery_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  event_type text not null check (event_type in ('view','like','save','share','open_artist','search')),
  category text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists projects_category_idx on public.projects(category);
create index if not exists projects_published_idx on public.projects(published);
create index if not exists events_session_idx on public.discovery_events(session_id, created_at desc);
create index if not exists events_user_idx on public.discovery_events(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.discovery_events enable row level security;

create policy "published projects are public"
on public.projects for select
using (published = true or owner_id = auth.uid());

create policy "members can update their profile"
on public.profiles for update
using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles are public"
on public.profiles for select
using (true);

create policy "members manage their own projects"
on public.projects for insert
with check (owner_id = auth.uid());

create policy "members update their own projects"
on public.projects for update
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "members delete their own projects"
on public.projects for delete
using (owner_id = auth.uid());

create policy "events can be inserted"
on public.discovery_events for insert
with check (user_id is null or user_id = auth.uid());

-- Do not expose raw discovery events to anonymous clients.
-- Aggregate them server-side into recommendation scores.
