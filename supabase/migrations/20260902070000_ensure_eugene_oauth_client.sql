-- Ensure the production Eugene Card OAuth client exists and is active.
-- The application also self-heals a missing seed row, but this migration is
-- the canonical database-side registration.
insert into public.oauth_clients(client_id,name,client_type,redirect_uris,allowed_scopes,active)
values(
  'eugene-card',
  'Eugene Card',
  'public',
  array['https://eugene-card-1.vercel.app/?connect=lunarist'],
  array['identity','profile','offline_access'],
  true
)
on conflict (client_id) do update set
  name=excluded.name,
  client_type=excluded.client_type,
  redirect_uris=excluded.redirect_uris,
  allowed_scopes=excluded.allowed_scopes,
  active=true,
  updated_at=now();
