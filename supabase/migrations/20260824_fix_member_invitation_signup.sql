-- Fix Lunarist one-time Member invitation signup.
-- The browser reserves an invitation before auth.users exists.
-- The Before User Created hook then allows the matching email, and the AFTER INSERT trigger consumes it once.

create or replace function public.reserve_member_invitation(p_code text, p_email text, p_nonce text)
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
  if normalized_email = '' or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
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

  return jsonb_build_object('success', true, 'code', inv.code, 'nonce', normalized_nonce, 'email', normalized_email);
end;
$$;

revoke execute on function public.reserve_member_invitation(text,text,text) from public, authenticated;
grant execute on function public.reserve_member_invitation(text,text,text) to anon;

revoke execute on function public.create_member_invitation(timestamptz) from public, anon;
grant execute on function public.create_member_invitation(timestamptz) to authenticated;

grant execute on function public.redeem_member_invitation(text,text) to authenticated;
revoke execute on function public.redeem_member_invitation(text,text) from anon, public;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_require_member_invitation(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_require_member_invitation(jsonb) from public, anon, authenticated;
