-- Lunarist Studio — account roles
-- Four tiers going forward:
--   Guest              not authenticated (no row in this table)
--   User                account_type = 'user'    — has a profile, cannot publish work
--   Lunarist Member      account_type = 'member'  — can create & submit projects
--   Administrator        is_admin = true          — full Studio access (implies Member)

alter table public.profiles
  add column if not exists account_type text not null default 'user'
  check (account_type in ('user','member'));

-- Grandfather every account that already exists in as a full Lunarist Member.
update public.profiles set account_type = 'member' where account_type = 'user';

-- New signups start as a plain User; a Studio admin promotes them to Member.
create or replace function public.lunarist_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  requested_display text;
  base_username text;
  final_username text;
  suffix text;
begin
  requested_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username',''), '[^a-z0-9_]', '', 'g'));
  requested_username := left(requested_username, 32);
  requested_display := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name','')), '');

  if requested_username = '' then
    base_username := lower(regexp_replace(split_part(coalesce(new.email,'member'), '@', 1), '[^a-z0-9_]', '', 'g'));
    base_username := left(coalesce(nullif(base_username,''),'member'), 24);
    suffix := lower(replace(left(new.id::text, 8), '-', ''));
    final_username := left(base_username || '_' || suffix, 32);
  else
    final_username := requested_username;
  end if;

  if exists (select 1 from public.profiles where username = final_username) then
    final_username := left(final_username, 23) || '_' || lower(replace(left(new.id::text, 8), '-', ''));
  end if;

  insert into public.profiles (id, username, display_name, role, bio, skills, available, is_admin, account_type)
  values (
    new.id,
    final_username,
    coalesce(requested_display, nullif(split_part(coalesce(new.email,'Lunarist member'), '@', 1), ''), 'Lunarist member'),
    '', '', '{}', true, false, 'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Extend the existing privilege-escalation guard to also protect account_type,
-- the same way it already protects is_admin: only an existing admin can change it.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.account_type is distinct from old.account_type) then
    if not exists (
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

-- Only Lunarist Members and Administrators may create new projects.
-- (Existing projects owned by a since-downgraded account remain editable —
-- this only gates creating new work, per "can't publish/submit projects".)
drop policy if exists "members manage their own projects" on public.projects;
create policy "members manage their own projects" on public.projects
for insert to authenticated with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.account_type = 'member' or p.is_admin = true)
  )
);
