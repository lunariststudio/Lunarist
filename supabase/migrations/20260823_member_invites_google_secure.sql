-- Lunarist: secure one-time member invitations for email + Google signup
-- This migration upgrades the existing member_invitations system.

alter table public.member_invitations
  add column if not exists reserved_email text,
  add column if not exists reserved_nonce text,
  add column if not exists reserved_at timestamptz;

create unique index if not exists member_invitations_reserved_nonce_uidx
  on public.member_invitations(reserved_nonce)
  where reserved_nonce is not null;

create index if not exists member_invitations_reserved_email_idx
  on public.member_invitations(lower(reserved_email), used_at, expires_at);

-- Reserve an invitation for the email that will create the account.
-- The reservation is what lets the Google OAuth flow be enforced by the
-- before-user-created hook without trusting browser-only localStorage.
drop function if exists public.reserve_member_invitation(text,text,text);
create or replace function public.reserve_member_invitation(
  p_code text,
  p_email text,
  p_nonce text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inv public.member_invitations%rowtype;
  normalized_email text := lower(trim(p_email));
  normalized_code text := upper(trim(p_code));
  normalized_nonce text := trim(p_nonce);
begin
  if normalized_email = '' or normalized_email !~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' then
    raise exception 'A valid email is required';
  end if;
  if normalized_nonce = '' or length(normalized_nonce) < 24 then
    raise exception 'Invalid invitation reservation';
  end if;

  select * into inv
  from public.member_invitations
  where code = normalized_code
    and used_at is null
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    raise exception 'This invitation is invalid, expired, or already used';
  end if;

  -- A live reservation cannot be moved to another email.
  if inv.reserved_at is not null
     and inv.reserved_at > now() - interval '24 hours'
     and lower(coalesce(inv.reserved_email,'')) <> normalized_email then
    raise exception 'This invitation is already reserved for another email';
  end if;

  update public.member_invitations
  set reserved_email = normalized_email,
      reserved_nonce = normalized_nonce,
      reserved_at = now()
  where id = inv.id;

  return jsonb_build_object(
    'success', true,
    'code', inv.code,
    'nonce', normalized_nonce,
    'email', normalized_email
  );
end;
$$;

revoke all on function public.reserve_member_invitation(text,text,text) from public, anon, authenticated;

-- Redemption remains atomic. It also rejects an invitation when the account
-- existed before the reservation, which prevents an existing account from
-- consuming a member invite.
drop function if exists public.redeem_member_invitation(text);
drop function if exists public.redeem_member_invitation(text,text);
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
  if u.created_at < inv.reserved_at then
    raise exception 'This invitation can only be used when creating a new account';
  end if;

  update public.member_invitations
  set used_at = now(), used_by = uid
  where id = inv.id;

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

-- Consume the reservation immediately after Auth creates a user. This is the
-- server-side bridge that makes Google OAuth and email signup equivalent.
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

  insert into public.profiles(id,username,display_name,account_type)
  values(new.id,final_username,display_name,'member')
  on conflict (id) do update
    set account_type = 'member';

  return new;
end;
$$;

drop trigger if exists zz_member_invitation_after_user on auth.users;
create trigger zz_member_invitation_after_user
  after insert on auth.users
  for each row execute procedure public.consume_member_invitation_for_new_user();

-- Supabase Auth Before User Created Hook.
-- Register this function in Authentication > Hooks > Before User Created.
create or replace function public.hook_require_member_invitation(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  email text := lower(trim(event->'user'->>'email'));
begin
  if email is null or email = '' then
    return jsonb_build_object('error',jsonb_build_object('http_code',400,'message','A valid email is required for a Lunarist Member invitation.'));
  end if;

  if exists (
    select 1 from public.member_invitations
    where lower(reserved_email) = email
      and used_at is null
      and reserved_at is not null
      and reserved_at > now() - interval '24 hours'
      and (expires_at is null or expires_at > now())
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error',jsonb_build_object(
      'http_code',403,
      'message','Lunarist Member signup requires a valid one-time invitation.'
    )
  );
end;
$$;

grant execute on function public.hook_require_member_invitation(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_require_member_invitation(jsonb) from anon, authenticated, public;

-- NOTE: The function above must be registered as the Supabase Auth
-- "Before User Created" hook. Supabase supports Postgres functions for this
-- hook. URI: pg-functions://postgres/public/hook_require_member_invitation
