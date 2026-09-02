create table if not exists public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  name text not null,
  client_type text not null default 'public' check (client_type in ('public','confidential')),
  redirect_uris text[] not null default '{}',
  allowed_scopes text[] not null default '{identity,profile}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oauth_authorization_sessions (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  lunarist_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  lunarist_user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  scope text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256' check (code_challenge_method = 'S256'),
  state text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  lunarist_user_id uuid not null references auth.users(id) on delete cascade,
  access_token_hash text unique,
  refresh_token_hash text unique,
  scope text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_sessions_expiry_idx on public.oauth_authorization_sessions(expires_at);
create index if not exists oauth_codes_client_idx on public.oauth_authorization_codes(client_id, expires_at);
create index if not exists oauth_codes_user_idx on public.oauth_authorization_codes(lunarist_user_id, expires_at);
create index if not exists oauth_tokens_client_idx on public.oauth_tokens(client_id, revoked_at);
create index if not exists oauth_tokens_user_idx on public.oauth_tokens(lunarist_user_id, revoked_at);

alter table public.oauth_clients enable row level security;
alter table public.oauth_authorization_sessions enable row level security;
alter table public.oauth_authorization_codes enable row level security;
alter table public.oauth_tokens enable row level security;
revoke all on public.oauth_clients from anon, authenticated;
revoke all on public.oauth_authorization_sessions from anon, authenticated;
revoke all on public.oauth_authorization_codes from anon, authenticated;
revoke all on public.oauth_tokens from anon, authenticated;

insert into public.oauth_clients(client_id,name,client_type,redirect_uris,allowed_scopes,active)
values('eugene-card','Eugene Card','public',array['https://eugene-card-1.vercel.app/?connect=lunarist'],array['openid','profile','email','offline_access','identity'],true)
on conflict (client_id) do update set
  name=excluded.name,
  client_type=excluded.client_type,
  redirect_uris=excluded.redirect_uris,
  allowed_scopes=excluded.allowed_scopes,
  active=true,
  updated_at=now();
