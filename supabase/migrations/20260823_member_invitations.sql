create extension if not exists pgcrypto;

create table if not exists public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);

create index if not exists member_invitations_code_idx on public.member_invitations(code);
create index if not exists member_invitations_unused_idx on public.member_invitations(used_at, expires_at);

alter table public.member_invitations enable row level security;

revoke all on public.member_invitations from anon, authenticated;

drop function if exists public.create_member_invitation(timestamptz);
create or replace function public.create_member_invitation(p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  new_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id=uid and is_admin=true) then
    raise exception 'Administrator access required';
  end if;

  loop
    new_code := upper(encode(gen_random_bytes(6),'hex'));
    exit when not exists (select 1 from public.member_invitations where code=new_code);
  end loop;

  insert into public.member_invitations(code,created_by,expires_at)
  values(new_code,uid,p_expires_at)
  returning id into new_id;

  return jsonb_build_object('id',new_id,'code',new_code,'expires_at',p_expires_at);
end;
$$;

drop function if exists public.redeem_member_invitation(text);
create or replace function public.redeem_member_invitation(p_code text)
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
  select * into u from auth.users where id=uid;

  select * into inv
  from public.member_invitations
  where code=upper(trim(p_code))
    and used_at is null
    and (expires_at is null or expires_at > now())
  for update skip locked;

  if not found then raise exception 'This invitation is invalid, expired, or already used'; end if;

  update public.member_invitations
  set used_at=now(), used_by=uid
  where id=inv.id;

  if exists (select 1 from public.profiles where id=uid) then
    update public.profiles set account_type='member' where id=uid;
  else
    base_username := lower(regexp_replace(coalesce(u.raw_user_meta_data->>'username', split_part(coalesce(u.email,''),'@',1), 'member'), '[^a-z0-9_]', '', 'g'));
    if base_username='' then base_username='member'; end if;
    final_username := left(base_username, 24);
    while exists (select 1 from public.profiles where username=final_username) loop
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

grant execute on function public.create_member_invitation(timestamptz) to authenticated;
grant execute on function public.redeem_member_invitation(text) to authenticated;
