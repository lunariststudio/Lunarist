// Legacy Eugene Card OAuth implementation retired.
//
// Eugene Card is now the OAuth client and Lunarist is the OAuth authorization
// server. The live integration is implemented by:
//   /oauth/authorize
//   /oauth/token
//   /oauth/userinfo
//   /oauth/revoke
// and the registered callback bridge:
//   /api/eugene-card/callback
//
// Do not add browser-local token exchange or the former /api/oauth/* endpoints.
export const EUGENE_OAUTH_RETIRED=true;
