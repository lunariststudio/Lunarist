-- Lunarist Phase 4 — real server-side recommendations.
-- Additive migration: preserves existing projects and discovery events.

create index if not exists discovery_events_session_created_idx
  on public.discovery_events(session_id, created_at desc);
create index if not exists discovery_events_project_created_idx
  on public.discovery_events(project_id, created_at desc);
create index if not exists discovery_events_category_created_idx
  on public.discovery_events(category, created_at desc);

create or replace function public.get_recommendations(
  p_session_id text,
  p_limit integer default 5
)
returns table (
  project_id uuid,
  recommendation_score numeric,
  interest_score numeric,
  tag_score numeric,
  trending_score numeric,
  freshness_score numeric,
  artist_affinity_score numeric,
  exploration_score numeric
)
language sql
stable
set search_path = public
as $$
with
settings as (
  select greatest(1, least(coalesce(p_limit, 5), 20))::integer as lim
),
viewer_events as (
  select
    e.project_id,
    e.category,
    e.event_type,
    e.metadata,
    e.created_at,
    case e.event_type when 'like' then 4.0 when 'save' then 3.0 when 'share' then 2.0 else 1.0 end as weight
  from public.discovery_events e
  where e.session_id = left(coalesce(p_session_id, ''), 128)
),
category_interest as (
  select category, sum(weight) as weight
  from viewer_events
  where category is not null
  group by category
),
tag_interest as (
  select lower(trim(t.value)) as tag, sum(v.weight) as weight
  from viewer_events v
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(v.metadata->'tags') = 'array' then v.metadata->'tags' else '[]'::jsonb end
  ) t(value)
  where trim(t.value) <> ''
  group by lower(trim(t.value))
),
artist_interest as (
  select p.owner_id, sum(v.weight) as weight
  from viewer_events v
  join public.projects p on p.id = v.project_id
  where v.project_id is not null
  group by p.owner_id
),
seen as (
  select distinct project_id
  from viewer_events
  where project_id is not null
),
trend_raw as (
  select
    p.id,
    count(e.*) filter (where e.event_type in ('view','like','save','share'))::numeric as event_count
  from public.projects p
  left join public.discovery_events e
    on e.project_id = p.id
   and e.created_at >= now() - interval '7 days'
  where p.status = 'published' and p.published = true
  group by p.id
),
trend_scale as (
  select greatest(coalesce(max(event_count), 0), 1)::numeric as max_events
  from trend_raw
),
candidates as (
  select
    p.id,
    p.owner_id,
    p.category,
    coalesce(p.tags, '{}'::text[]) as tags,
    p.created_at,
    coalesce(tr.event_count, 0)::numeric as trend_events
  from public.projects p
  left join trend_raw tr on tr.id = p.id
  where p.status = 'published'
    and p.published = true
    and not exists (select 1 from seen s where s.project_id = p.id)
),
scored as (
  select
    c.id,
    least(1.0, coalesce(ci.weight, 0) / 10.0) as interest_score,
    least(1.0, coalesce((
      select sum(ti.weight)
      from unnest(c.tags) tag
      left join tag_interest ti on ti.tag = lower(trim(tag))
    ), 0) / 20.0) as tag_score,
    least(1.0, c.trend_events / ts.max_events) as trending_score,
    greatest(0.0, least(1.0, exp(-greatest(0, extract(epoch from (now() - c.created_at))) / (86400.0 * 60.0)))) as freshness_score,
    least(1.0, coalesce(ai.weight, 0) / 10.0) as artist_affinity_score,
    mod(abs(hashtext(left(coalesce(p_session_id, '') || ':' || c.id::text, 1000)))::numeric, 100000) / 100000.0 as exploration_score
  from candidates c
  left join category_interest ci on ci.category = c.category
  left join artist_interest ai on ai.owner_id = c.owner_id
  cross join trend_scale ts
),
ranked as (
  select
    id,
    interest_score,
    tag_score,
    trending_score,
    freshness_score,
    artist_affinity_score,
    exploration_score,
    (
      interest_score * 40.0 +
      tag_score * 20.0 +
      trending_score * 15.0 +
      freshness_score * 10.0 +
      artist_affinity_score * 10.0 +
      exploration_score * 5.0
    ) as recommendation_score
  from scored
)
select
  id as project_id,
  round(recommendation_score::numeric, 4),
  round(interest_score::numeric, 4),
  round(tag_score::numeric, 4),
  round(trending_score::numeric, 4),
  round(freshness_score::numeric, 4),
  round(artist_affinity_score::numeric, 4),
  round(exploration_score::numeric, 4)
from ranked
order by recommendation_score desc
limit (select lim from settings);
$$;

revoke all on function public.get_recommendations(text, integer) from public;
revoke all on function public.get_recommendations(text, integer) from anon;
revoke all on function public.get_recommendations(text, integer) from authenticated;
grant execute on function public.get_recommendations(text, integer) to service_role;
