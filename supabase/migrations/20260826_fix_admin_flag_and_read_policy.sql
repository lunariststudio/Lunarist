-- Lunarist: fix "Administrator access required" on Promote/Revoke Member
--
-- Two separate bugs were combining to make Admin Studio *look* usable
-- (member list loads, "Administrator" badge shows) while every real
-- server-side action 403s:
--
-- 1) The "admins can read all profiles" RLS policy on public.profiles
--    (20260821_lunarist_v11.sql) reads:
--        using (is_admin = true or true)
--    The trailing `or true` makes the condition always true, for any
--    authenticated user, admin or not. So the Members Management page
--    loads for anyone who can reach the /admin route client-side — it
--    never actually proved the viewer was an admin. That's what made
--    the page look fine while the buttons failed.
--
-- 2) /api/lunarist and /api/invitations check the REAL `is_admin`
--    column (via the service-role key, bypassing RLS entirely) before
--    allowing Promote/Revoke or invitation management. If the signed-in
--    studio account's profile row never actually got `is_admin = true`
--    written to it (e.g. the profile was created by the client-side
--    fallback insert in refreshUser() before the "create profile"
--    trigger — or the account already existed before the phase2
--    migration's one-time backfill ran), that check correctly returns
--    false and the request is rejected — even though the UI has been
--    quietly treating the account as an admin the whole time via a
--    client-side-only `email === 'lunariststudio@gmail.com'` fallback
--    that never touched the database.

-- Fix 1: the read policy should actually gate on the CALLER being an
-- admin, not on an always-true expression.
drop policy if exists "admins can read all profiles" on public.profiles;
create policy "admins can read all profiles" on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- Fix 2: durably set is_admin/account_type for the designated Studio
-- account, bypassing the privilege-escalation trigger via the same
-- transaction-local flag introduced in 20260825_fix_member_promotion.sql
-- (a plain UPDATE here would otherwise get silently reverted by that
-- trigger, the same way invitation redemption was). Wrapped explicitly
-- so the flag and the UPDATE are guaranteed to run in the same
-- transaction regardless of how this file is executed.
begin;
select set_config('lunarist.allow_role_change', 'on', true);

update public.profiles p
set is_admin = true,
    account_type = 'member',
    role = case when coalesce(nullif(trim(p.role), ''), '') = '' then 'Administrator' else p.role end,
    updated_at = now()
from auth.users u
where u.id = p.id
  and lower(u.email) = 'lunariststudio@gmail.com'
  and p.is_admin is distinct from true;
commit;
