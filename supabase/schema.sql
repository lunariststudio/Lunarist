-- Lunarist Studio production schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
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
  media_type text default 'image' check (media_type in ('image','video')),
  published boolean default false,
  featured boolean default false,
  views bigint not null default 0,
  likes bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.discovery_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  user_id uuid,
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

-- The RLS automation trigger is privileged and must never be callable through the public Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "members can insert their profile" on public.profiles;
create policy "members can insert their profile" on public.profiles
for insert to authenticated with check (id = auth.uid());

drop policy if exists "members can update their profile" on public.profiles;
create policy "members can update their profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "published projects are public" on public.projects;
create policy "published projects are public" on public.projects
for select using (published = true or owner_id = auth.uid());

drop policy if exists "members manage their own projects" on public.projects;
create policy "members manage their own projects" on public.projects
for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "members update their own projects" on public.projects;
create policy "members update their own projects" on public.projects
for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "members delete their own projects" on public.projects;
create policy "members delete their own projects" on public.projects
for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "events can be inserted" on public.discovery_events;
create policy "events can be inserted" on public.discovery_events
for insert to anon, authenticated
with check (user_id is null or user_id = auth.uid());

-- No public SELECT policy for discovery_events: raw behavioral data stays private.

-- Seed public content so the uploaded prototype is immediately backed by Supabase.
insert into public.profiles (id,username,display_name,role,bio,avatar_url,skills,available)
values
('11111111-1111-4111-8111-111111111111','yujin','Yujin','Motion Designer · Animator','Turning music, characters and atmosphere into moving stories.','https://i.pravatar.cc/160?img=12',array['Motion Design','MV','Compositing'],true),
('22222222-2222-4222-8222-222222222222','moffy','Moffy','Illustrator · Character Artist','Soft worlds, expressive characters and visual development.','https://i.pravatar.cc/160?img=32',array['Illustration','Character','Concept'],true),
('33333333-3333-4333-8333-333333333333','astra','Astra','Graphic Designer','Identity, key visuals and sharp graphic systems.','https://i.pravatar.cc/160?img=47',array['Graphic Design','Branding','PV'],false),
('44444444-4444-4444-8444-444444444444','noctis','Noctis','3D Artist · Compositor','Cinematic spaces, lighting and post-production.','https://i.pravatar.cc/160?img=59',array['3D','Compositing','VFX'],true)
on conflict (id) do nothing;

insert into public.projects (id,owner_id,title,slug,description,category,tags,thumbnail_url,media_url,media_type,published,featured,views,likes)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Stellar Night — MV','stellar-night-mv','A cinematic music video concept built around rhythm, glow and celestial motion.','MV',array['MV','Motion Design','VTuber'],'https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg','https://www.youtube.com/embed/ScMzIvxBSi4','video',true,true,1840,142),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Moffy — Character Reel','moffy-character-reel','Character exploration and expressive illustration studies.','Illustration',array['Illustration','Character'],'https://images.unsplash.com/photo-1577083288073-40892c0860a4?auto=format&fit=crop&w=900&q=80',null,'image',true,false,1260,118),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','Lunarist Visual Identity','lunarist-visual-identity','A visual identity system for a dream-driven creative studio.','Graphic Design',array['Branding','Graphic Design'],'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=80',null,'image',true,true,920,87),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','44444444-4444-4444-8444-444444444444','Moonbase — 3D Environment','moonbase-3d-environment','A moody 3D environment exploration with cinematic lighting.','3D',array['3D','VFX'],'https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&w=900&q=80',null,'image',true,false,1510,129),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','Dream Sequence — PV','dream-sequence-pv','Promotional animation designed to introduce a new character world.','PV',array['PV','Animation'],'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg','https://www.youtube.com/embed/aqz-KE-bpKQ','video',true,true,2100,190),
('ffffffff-ffff-4fff-8fff-ffffffffffff','22222222-2222-4222-8222-222222222222','Minstrel Concept Sheet','minstrel-concept-sheet','A concept sheet exploring costume, shape language and mood.','Illustration',array['Illustration','Concept'],'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=80',null,'image',true,false,740,64),
('12121212-1212-4121-8121-121212121212','33333333-3333-4333-8333-333333333333','Neon Signal — Key Visual','neon-signal-key-visual','Key visual exploration using contrast, typography and futuristic color.','Graphic Design',array['Graphic Design','PV'],'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=900&q=80',null,'image',true,false,1130,102),
('34343434-3434-4343-8343-343434343434','44444444-4444-4444-8444-444444444444','Afterglow — Compositing Study','afterglow-compositing-study','Post-production study focused on atmosphere, depth and light integration.','Compositing',array['Compositing','VFX'],'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=900&q=80',null,'image',true,false,980,91)
on conflict (id) do nothing;
