Lunarist — Secure One-Time Member Invitations (Email + Google)

What changed
- Email/password Member signup requires a one-time invitation reservation.
- Google Member signup requires a one-time invitation reservation tied to the email entered before OAuth.
- Existing Google members can still sign in normally without an invitation.
- An existing account cannot consume a new invitation.
- Invitations are reserved atomically in Supabase and consumed when Auth creates the user.
- The browser nonce is not the security boundary; Supabase validates the reservation server-side.
- The included Before User Created hook blocks direct/bypassed signups that do not have a valid reserved invitation.

Deploy
1. Deploy the whole package to Vercel.
2. Keep the existing environment variables, including SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, PAYPAL_*, and DEEPL_API_KEY as applicable.
3. The migration is already applied to the connected Lunarist Supabase project, but keep the SQL file for reproducible deployments.
4. In Supabase Dashboard, register the Postgres Auth Hook:
   Authentication -> Hooks -> Before User Created
   Function: public.hook_require_member_invitation
   Function URI: pg-functions://postgres/public/hook_require_member_invitation
5. Test with a fresh email account and a fresh Google account using the same one-time invitation.

Google flow
- Open the invitation link.
- Switch to Create account.
- Enter the Google account email and invitation code.
- Continue with Google.
- Google must return the same email that was reserved.
- The invitation is consumed only for the newly created Auth user.

Important
- Do not put SUPABASE_SERVICE_ROLE_KEY or DEEPL_API_KEY in the browser.
- Existing users are not asked for an invitation when signing in with Google; only creation of a new account is invite-gated.
