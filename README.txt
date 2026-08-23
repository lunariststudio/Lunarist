Lunarist — One-Time Member Invitations

1. Run supabase/migrations/20260823_member_invitations.sql in the Lunarist Supabase project.
2. Deploy the entire package to Vercel, including api/invitations.js.
3. Admin Studio now has an Invitations tab.
4. Create an invitation to receive a one-time code and link.
5. The link format is https://YOUR-DOMAIN/?invite=CODE.
6. A visitor opening the link gets the signup form with the code prefilled.
7. After authentication, the code is redeemed atomically and the account becomes a Lunarist Member.
8. A used, revoked, or expired invitation cannot be redeemed again.

No DeepL or PayPal secrets are included in this package.
