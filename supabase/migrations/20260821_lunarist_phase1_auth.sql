-- Lunarist Platform v1.1 - Phase 1 Authentication
-- Creates a profile automatically when a Supabase Auth user is created.
-- raw_user_meta_data is used only for initial profile fields; authorization
-- continues to use server-controlled columns such as profiles.is_admin.

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

  insert into public.profiles (id, username, display_name, role, bio, skills, available, is_admin)
  values (
    new.id,
    final_username,
    coalesce(requested_display, nullif(split_part(coalesce(new.email,'Lunarist member'), '@', 1), ''), 'Lunarist member'),
    '', '', '{}', true, false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.lunarist_create_profile() from public;
grant execute on function public.lunarist_create_profile() to postgres;

drop trigger if exists lunarist_create_profile_on_signup on auth.users;
create trigger lunarist_create_profile_on_signup
after insert on auth.users
for each row execute function public.lunarist_create_profile();

-- The profile trigger must be callable by the Auth system but not exposed as a
-- public Data API function.
revoke execute on function public.lunarist_create_profile() from anon, authenticated;
