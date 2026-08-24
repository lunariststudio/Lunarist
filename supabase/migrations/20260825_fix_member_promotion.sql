-- Lunarist: fix Member promotion
--
-- Root cause of both reported bugs:
-- `prevent_profile_privilege_escalation()` (trigger on public.profiles,
-- added in 20260821_lunarist_account_roles.sql) silently reverts any
-- change to `account_type`/`is_admin` unless the CURRENT caller
-- (auth.uid()) already has is_admin = true on their own profile row.
--
-- That is correct for blocking a user from editing their own row to
-- self-promote, but it also silently reverted the legitimate,
-- server-controlled promotion done inside `redeem_member_invitation()`
-- and `consume_member_invitation_for_new_user()` — because the person
-- redeeming an invitation is, by definition, not an admin yet. The
-- UPDATE would appear to succeed (no error) but `account_type` would
-- snap right back to 'user'. This is why invitation codes "didn't work"
-- for both brand-new signups and already-logged-in users.
--
-- Admin Studio's "Promote to Member" button was broken for an unrelated,
-- simpler reason: `/api/lunarist` never implemented the `toggle-member`
-- action the button posts to, so every click failed. That endpoint is
-- fixed in api/lunarist.js (this migration adds the RPC it calls).

-- 1) Let trusted, server-side functions bypass the guard for the one
--    statement they need to, via a transaction-local flag they set
--    right before the UPDATE. The flag never leaves the transaction it
--    was set in, so it can't be used to bypass the guard from a normal
--    client request.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.account_type is distinct from old.account_type) then
    if coalesce(current_setting('lunarist.allow_role_change', true), '') <> 'on'
       and not exists (
         select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_admin = true
       ) then
      new.is_admin := old.is_admin;
      new.account_type := old.account_type;
    end if;
  end if;
  return new;
end;
$$;

-- 2) Set that flag inside invitation redemption before it promotes the
--    account, for both the "redeem after signing in" RPC and the
--    "consume immediately after auth.users insert" trigger (Google
--    OAuth path).
create or replace function public.redeem_member_invitation(
  p_code text,
  p_nonce text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  inv public.member_invitations%rowtype;
  u auth.users%rowtype;
  base_username text;
  final_username text;
  display_name text;
  n integer := 0;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into u from auth.users where id = uid;

  -- Idempotent success if the post-auth trigger already consumed it.
  if p_code is not null and exists (
    select 1 from public.member_invitations
    where code = upper(trim(p_code)) and used_by = uid
  ) then
    perform set_config('lunarist.allow_role_change', 'on', true);
    update public.profiles set account_type = 'member' where id = uid and account_type <> 'member';
    return jsonb_build_object('success',true,'already_redeemed',true,'code',upper(trim(p_code)));
  end if;

  select * into inv
  from public.member_invitations
  where code = upper(trim(p_code))
    and used_at is null
    and (expires_at is null or expires_at > now())
  for update;

  if not found then raise exception 'This invitation is invalid, expired, or already used'; end if;
  if inv.reserved_nonce is null or inv.reserved_email is null then
    raise exception 'This invitation must be started from the invitation signup flow';
  end if;
  if p_nonce is null or inv.reserved_nonce <> p_nonce then
    raise exception 'Invitation reservation does not match';
  end if;
  if lower(coalesce(u.email,'')) <> lower(inv.reserved_email) then
    raise exception 'This invitation is reserved for a different email';
  end if;
  if inv.reserved_at is null or inv.reserved_at < now() - interval '24 hours' then
    raise exception 'This invitation reservation has expired';
  end if;

  update public.member_invitations
  set used_at = now(), used_by = uid
  where id = inv.id;

  perform set_config('lunarist.allow_role_change', 'on', true);

  if exists (select 1 from public.profiles where id = uid) then
    update public.profiles set account_type = 'member' where id = uid;
  else
    base_username := lower(regexp_replace(coalesce(u.raw_user_meta_data->>'username', split_part(coalesce(u.email,''),'@',1), 'member'), '[^a-z0-9_]', '', 'g'));
    if base_username = '' then base_username = 'member'; end if;
    final_username := left(base_username, 24);
    while exists (select 1 from public.profiles where username = final_username) loop
      n := n + 1;
      final_username := left(base_username, 24) || '_' || n::text;
    end loop;
    display_name := coalesce(nullif(u.raw_user_meta_data->>'display_name',''), final_username);
    insert into public.profiles(id,username,display_name,account_type)
    values(uid,final_username,display_name,'member');
  end if;

  return jsonb_build_object('success',true,'invitation_id',inv.id,'code',inv.code);
end;
$$;

grant execute on function public.redeem_member_invitation(text,text) to authenticated;
revoke execute on function public.redeem_member_invitation(text,text) from anon, public;

create or replace function public.consume_member_invitation_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inv public.member_invitations%rowtype;
  base_username text;
  final_username text;
  display_name text;
  n integer := 0;
begin
  if new.email is null then return new; end if;

  select * into inv
  from public.member_invitations
  where lower(reserved_email) = lower(new.email)
    and used_at is null
    and reserved_at is not null
    and reserved_at > now() - interval '24 hours'
    and (expires_at is null or expires_at > now())
  order by reserved_at desc
  limit 1
  for update;

  if not found then return new; end if;

  update public.member_invitations
  set used_at = now(), used_by = new.id
  where id = inv.id;

  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1), 'member'), '[^a-z0-9_]', '', 'g'));
  if base_username = '' then base_username = 'member'; end if;
  final_username := left(base_username, 24);
  while exists (select 1 from public.profiles where username = final_username and id <> new.id) loop
    n := n + 1;
    final_username := left(base_username, 24) || '_' || n::text;
  end loop;
  display_name := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), final_username);

  perform set_config('lunarist.allow_role_change', 'on', true);

  insert into public.profiles(id,username,display_name,account_type)
  values(new.id,final_username,display_name,'member')
  on conflict (id) do update
    set account_type = 'member';

  return new;
end;
$$;

-- 3) The RPC Admin Studio's "Promote to Member" / "Revoke Member" button
--    actually needs. Callable only by an existing admin, for any target
--    profile, and also flips the bypass flag for its own UPDATE.
drop function if exists public.admin_set_account_type(uuid, text);
create or replace function public.admin_set_account_type(
  p_target_id uuid,
  p_account_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target public.profiles%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_admin = true
  ) then
    raise exception 'Administrator access required';
  end if;
  if p_account_type not in ('user','member') then
    raise exception 'Invalid account type';
  end if;

  select * into target from public.profiles where id = p_target_id for update;
  if not found then raise exception 'Member not found'; end if;
  if target.is_admin then raise exception 'Administrators cannot be changed here'; end if;

  perform set_config('lunarist.allow_role_change', 'on', true);
  update public.profiles set account_type = p_account_type where id = p_target_id;

  return jsonb_build_object('success', true, 'id', p_target_id, 'account_type', p_account_type);
end;
$$;

revoke all on function public.admin_set_account_type(uuid, text) from public, anon;
grant execute on function public.admin_set_account_type(uuid, text) to authenticated;
