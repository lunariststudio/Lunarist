alter table public.eugene_card_connections
  add column if not exists encrypted_access_token text,
  add column if not exists encrypted_refresh_token text,
  add column if not exists access_expires_at timestamptz,
  add column if not exists refresh_expires_at timestamptz,
  add column if not exists scope text default '',
  add column if not exists revoked_at timestamptz,
  add column if not exists token_type text default 'Bearer';

create index if not exists eugene_card_connections_user_idx
  on public.eugene_card_connections(lunarist_user_id);

create index if not exists eugene_card_connections_active_idx
  on public.eugene_card_connections(lunarist_user_id, revoked_at);

revoke all on public.eugene_card_connections from anon, authenticated;
