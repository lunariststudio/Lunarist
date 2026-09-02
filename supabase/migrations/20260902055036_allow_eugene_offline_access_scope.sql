-- Eugene Card requests offline_access so it can receive a refresh token.
update public.oauth_clients
set allowed_scopes = array['identity', 'profile', 'offline_access']
where client_id = 'eugene-card'
  and active = true;
