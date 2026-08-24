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
  status text default 'draft' check (status in ('draft','pending','published','archived')),
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

-- Lunarist Member invitation system (idempotent production sync)
alter table public.profiles add column if not exists account_type text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_type_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check check (account_type in ('user','member'));
  end if;
end $$;

create table if not exists public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  used_at timestamptz null,
  used_by uuid null references auth.users(id) on delete set null,
  reserved_email text null,
  reserved_nonce text null,
  reserved_at timestamptz null
);

create index if not exists member_invitations_code_idx on public.member_invitations(code);
create index if not exists member_invitations_reserved_email_idx on public.member_invitations(lower(reserved_email));

alter table public.member_invitations enable row level security;

-- Invitations are never directly readable by anonymous/authenticated clients.
-- Admin API uses service_role; redemption/reservation uses SECURITY DEFINER RPCs.
drop policy if exists "member invitations public read" on public.member_invitations;
drop policy if exists "member invitations public write" on public.member_invitations;

create or replace function public.create_member_invitation(p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  new_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = uid and (is_admin = true or lower(coalesce(role,'')) = 'administrator')
  ) then
    raise exception 'Administrator access required';
  end if;

  loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text || uid::text), 1, 12));
    exit when not exists (select 1 from public.member_invitations where code = new_code);
  end loop;

  insert into public.member_invitations(code, created_by, expires_at)
  values(new_code, uid, null)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'code', new_code, 'expires_at', null, 'never_expires', true);
end;
$$;

create or replace function public.reserve_member_invitation(p_code text, p_email text, p_nonce text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inv public.member_invitations%rowtype;
  normalized_email text := lower(trim(p_email));
  normalized_code text := upper(trim(p_code));
  normalized_nonce text := trim(p_nonce);
begin
  if normalized_email = '' or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email is required';
  end if;
  if normalized_nonce = '' or length(normalized_nonce) < 24 then
    raise exception 'Invalid invitation reservation';
  end if;

  select * into inv
  from public.member_invitations
  where code = normalized_code and used_at is null and expires_at is null
  for update;

  if not found then raise exception 'This invitation is invalid, revoked, or already used'; end if;

  if inv.reserved_at is not null
     and inv.reserved_at > now() - interval '24 hours'
     and lower(coalesce(inv.reserved_email,'')) <> normalized_email then
    raise exception 'This invitation is already reserved for another email';
  end if;

  update public.member_invitations
  set reserved_email=normalized_email, reserved_nonce=normalized_nonce, reserved_at=now()
  where id=inv.id;

  return jsonb_build_object('success',true,'code',inv.code,'nonce',normalized_nonce,'email',normalized_email);
end;
$$;

create or replace function public.redeem_member_invitation(p_code text, p_nonce text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  inv public.member_invitations%rowtype;
  u auth.users%rowtype;
  base_username text;
  final_username text;
  display_name text;
  n integer := 0;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into u from auth.users where id=uid;

  if p_code is not null and exists (
    select 1 from public.member_invitations where code=upper(trim(p_code)) and used_by=uid
  ) then
    perform set_config('lunarist.allow_role_change','on',true);
    update public.profiles set account_type='member' where id=uid;
    return jsonb_build_object('success',true,'already_redeemed',true,'code',upper(trim(p_code)));
  end if;

  select * into inv from public.member_invitations
  where code=upper(trim(p_code)) and used_at is null and expires_at is null for update;
  if not found then raise exception 'This invitation is invalid, revoked, or already used'; end if;
  if inv.reserved_nonce is null or inv.reserved_email is null then raise exception 'This invitation must be started from the invitation signup flow'; end if;
  if p_nonce is null or inv.reserved_nonce <> p_nonce then raise exception 'Invitation reservation does not match'; end if;
  if lower(coalesce(u.email,'')) <> lower(inv.reserved_email) then raise exception 'This invitation is reserved for a different email'; end if;
  if inv.reserved_at is null or inv.reserved_at < now() - interval '24 hours' then raise exception 'This invitation reservation has expired'; end if;

  update public.member_invitations set used_at=now(), used_by=uid where id=inv.id;
  perform set_config('lunarist.allow_role_change','on',true);

  if exists (select 1 from public.profiles where id=uid) then
    update public.profiles set account_type='member' where id=uid;
  else
    base_username := lower(regexp_replace(coalesce(u.raw_user_meta_data->>'username',split_part(coalesce(u.email,''),'@',1),'member'),'[^a-z0-9_]','','g'));
    if base_username='' then base_username='member'; end if;
    final_username := left(base_username,24);
    while exists (select 1 from public.profiles where username=final_username) loop
      n:=n+1; final_username := left(base_username,24)||'_'||n::text;
    end loop;
    display_name := coalesce(nullif(u.raw_user_meta_data->>'display_name',''),final_username);
    insert into public.profiles(id,username,display_name,account_type) values(uid,final_username,display_name,'member');
  end if;
  return jsonb_build_object('success',true,'invitation_id',inv.id,'code',inv.code);
end;
$$;

create or replace function public.consume_member_invitation_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inv public.member_invitations%rowtype;
  base_username text;
  final_username text;
  display_name text;
  n integer := 0;
begin
  if new.email is null then return new; end if;
  select * into inv from public.member_invitations
  where lower(reserved_email)=lower(new.email) and used_at is null and reserved_at is not null
    and reserved_at > now()-interval '24 hours' and expires_at is null
  order by reserved_at desc limit 1 for update;
  if not found then return new; end if;
  update public.member_invitations set used_at=now(), used_by=new.id where id=inv.id;
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1),'member'),'[^a-z0-9_]','','g'));
  if base_username='' then base_username='member'; end if;
  final_username:=left(base_username,24);
  while exists(select 1 from public.profiles where username=final_username and id<>new.id) loop
    n:=n+1; final_username:=left(base_username,24)||'_'||n::text;
  end loop;
  display_name:=coalesce(nullif(new.raw_user_meta_data->>'display_name',''),final_username);
  perform set_config('lunarist.allow_role_change','on',true);
  insert into public.profiles(id,username,display_name,account_type)
  values(new.id,final_username,display_name,'member')
  on conflict(id) do update set account_type='member';
  return new;
end;
$$;

create or replace function public.hook_require_member_invitation(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare email text := lower(trim(event->'user'->>'email'));
begin
  if email is null or email='' then
    return jsonb_build_object('error',jsonb_build_object('http_code',400,'message','A valid email is required for a Lunarist Member invitation.'));
  end if;
  if exists(select 1 from public.member_invitations where lower(reserved_email)=email and used_at is null and reserved_at is not null and reserved_at > now()-interval '24 hours' and expires_at is null) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Lunarist Member signup requires a valid one-time invitation.'));
end;
$$;

revoke execute on function public.create_member_invitation(timestamptz) from public, anon;
grant execute on function public.create_member_invitation(timestamptz) to authenticated;
revoke execute on function public.reserve_member_invitation(text,text,text) from public;
grant execute on function public.reserve_member_invitation(text,text,text) to anon, authenticated;
revoke execute on function public.redeem_member_invitation(text,text) from public, anon;
grant execute on function public.redeem_member_invitation(text,text) to authenticated;
grant execute on function public.hook_require_member_invitation(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_require_member_invitation(jsonb) from public, anon, authenticated;

-- Run after the normal profile-creation triggers so an invited user is always a Member.
drop trigger if exists zz_member_invitation_after_user on auth.users;
create trigger zz_member_invitation_after_user
after insert on auth.users
for each row execute function public.consume_member_invitation_for_new_user();
