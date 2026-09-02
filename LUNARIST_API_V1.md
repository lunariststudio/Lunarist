# Lunarist API v1

Admin Studio OAuth management now uses first-party Lunarist API endpoints instead of calling the legacy `/api/lunarist?resource=oauth-admin...` routes directly.

## Admin endpoints

- `GET /api/v1/oauth/apps` — list OAuth applications
- `POST /api/v1/oauth/apps` — create OAuth application
- `PATCH /api/v1/oauth/apps/:client_id` — update application
- `PATCH /api/v1/oauth/apps/:client_id/status` — enable/disable application
- `DELETE /api/v1/oauth/apps/:client_id/tokens` — revoke all application tokens
- `DELETE /api/v1/oauth/apps/:client_id` — delete application and dependent grants/codes
- `GET /api/v1/oauth/grants` — list OAuth grants
- `DELETE /api/v1/oauth/grants/:id` — revoke a grant

The API authenticates the signed-in Lunarist user and verifies Administrator access server-side. Supabase service credentials remain server-only and are never sent to the browser.
