create table if not exists public.client_reviews (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text not null check (char_length(btrim(review)) between 10 and 2000),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commission_id)
);

create index if not exists client_reviews_artist_created_idx on public.client_reviews(artist_id, created_at desc);
create index if not exists client_reviews_client_created_idx on public.client_reviews(client_id, created_at desc);

create or replace function public.validate_client_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.commissions%rowtype;
begin
  select * into c from public.commissions where id = new.commission_id;
  if not found then raise exception 'Commission not found'; end if;
  if c.client_id is null or c.client_id <> new.client_id then raise exception 'You can only review your own commission'; end if;
  if c.artist_id is null or c.artist_id <> new.artist_id then raise exception 'Review artist does not match commission'; end if;
  if c.status <> 'completed' then raise exception 'Reviews are available after a commission is completed'; end if;
  return new;
end;
$$;

drop trigger if exists validate_client_review_trigger on public.client_reviews;
create trigger validate_client_review_trigger before insert or update on public.client_reviews for each row execute function public.validate_client_review();

drop trigger if exists client_reviews_updated_at on public.client_reviews;
create or replace function public.touch_client_review_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
create trigger client_reviews_updated_at before update on public.client_reviews for each row execute function public.touch_client_review_updated_at();

alter table public.client_reviews enable row level security;

drop policy if exists client_reviews_public_read on public.client_reviews;
create policy client_reviews_public_read on public.client_reviews for select using (
  published = true or client_id = (select auth.uid()) or artist_id = (select auth.uid()) or public.is_admin()
);

drop policy if exists client_reviews_client_insert on public.client_reviews;
create policy client_reviews_client_insert on public.client_reviews for insert to authenticated with check (
  client_id = (select auth.uid()) and exists (
    select 1 from public.commissions c
    where c.id = commission_id and c.client_id = (select auth.uid()) and c.status = 'completed'
  )
);

drop policy if exists client_reviews_client_update on public.client_reviews;
create policy client_reviews_client_update on public.client_reviews for update to authenticated using (client_id = (select auth.uid()) or public.is_admin()) with check (client_id = (select auth.uid()) or public.is_admin());

drop policy if exists client_reviews_client_delete on public.client_reviews;
create policy client_reviews_client_delete on public.client_reviews for delete to authenticated using (client_id = (select auth.uid()) or public.is_admin());

grant select on public.client_reviews to anon;
grant select, insert, update, delete on public.client_reviews to authenticated;

create or replace view public.artist_review_summary as
select artist_id, count(*)::int as review_count, round(avg(rating)::numeric, 2) as average_rating
from public.client_reviews where published = true group by artist_id;

grant select on public.artist_review_summary to anon, authenticated;
