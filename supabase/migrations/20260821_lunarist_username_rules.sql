-- Lunarist Studio — username validation & reserved-word protection
-- Enforces the same rules the frontend applies (lowercase, a-z0-9_, 3-32 chars)
-- at the database layer, and blocks usernames that collide with app routes
-- like /discover, /artists, /api so profile URLs never break.

create or replace function public.lunarist_normalize_username()
returns trigger
language plpgsql
as $$
declare
  reserved text[] := array['discover','artists','api','admin','studio','www','login','signup','signin','logout','settings','null','undefined'];
  cleaned text;
begin
  cleaned := lower(regexp_replace(coalesce(new.username, ''), '[^a-z0-9_]', '', 'g'));

  if length(cleaned) < 3 then
    raise exception 'Username must be at least 3 characters (letters, numbers, underscore only).';
  end if;

  if length(cleaned) > 32 then
    cleaned := left(cleaned, 32);
  end if;

  if cleaned = any(reserved) then
    raise exception 'That username is reserved. Please choose another.';
  end if;

  new.username := cleaned;
  return new;
end;
$$;

drop trigger if exists trg_lunarist_normalize_username on public.profiles;
create trigger trg_lunarist_normalize_username
before insert or update of username on public.profiles
for each row execute function public.lunarist_normalize_username();

-- Fast case-insensitive lookups for /username profile routing.
create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));
