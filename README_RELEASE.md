# Lunarist — Latest Project ZIP

This package includes the current full Lunarist application package available in the workspace, with the latest Admin Studio member-toggle client fix applied.

## Included fixes/features
- Admin Studio → Invitations tab
- One-time invitation signup protection
- Google signup invitation protection
- Profile → Redeem Invitation
- Logged-in user invitation redemption
- Redeemed members treated as Lunarist Artists/Members
- Permanent invitation codes/links until Admin revokes them
- Admin Promote to Member / Revoke Member request now sends the Supabase access token
- Existing Supabase invitation migration included

## Security
No `.env.local` or secret environment files are included in this ZIP.
Configure production secrets in Vercel/Supabase environment settings.


Instagram Vercel variables:
- INSTAGRAM_ACCESS_TOKEN
- META_APP_ID (optional fallback)
- META_APP_SECRET (optional fallback)
