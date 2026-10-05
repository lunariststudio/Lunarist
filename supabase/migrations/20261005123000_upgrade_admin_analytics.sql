create or replace function public.admin_analytics(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
if not exists(select 1 from public.profiles where id=auth.uid() and is_admin=true) then raise exception 'administrator access required'; end if;
p_days:=greatest(1,least(coalesce(p_days,30),365));
with bounds as (select now()-make_interval(days=>p_days) since),
ev as (select e.* from public.site_analytics_events e,bounds b where e.created_at>=b.since),
legacy_visitors as (select v.visitor_id from public.site_visitors v,bounds b where v.last_seen>=b.since),
legacy_sessions as (select 'legacy:'||v.id::text session_id from public.site_visits v,bounds b where v.created_at>=b.since),
visitor_ids as (select visitor_id from ev where visitor_id is not null union select visitor_id from legacy_visitors where visitor_id is not null),
session_ids as (select session_id from ev where session_id is not null union select session_id from legacy_sessions),
session_counts as (select session_id,count(*) event_count from ev where session_id is not null group by session_id),
repeat_visitors as (select count(*) from (select visitor_id from ev where visitor_id is not null group by visitor_id having count(distinct session_id)>1) q),
engaged_sessions as (select distinct session_id from ev where session_id is not null and event_name in ('project_click','service_click','like','save','open_artist','share','inquiry_start','commission_inquiry')),
days as (select generate_series(date_trunc('day',now()-make_interval(days=>p_days-1)),date_trunc('day',now()),interval '1 day') day),
daily as (select to_char(days.day,'YYYY-MM-DD') day_key,
coalesce(count(e.*) filter(where e.event_name='page_view'),0) page_views,
coalesce(count(e.*) filter(where e.event_name='project_view'),0) project_views,
coalesce(count(e.*) filter(where e.event_name='service_view'),0) service_views,
coalesce(count(e.*) filter(where e.event_name='project_click'),0) project_clicks,
coalesce(count(e.*) filter(where e.event_name='service_click'),0) service_clicks,
coalesce(count(e.*) filter(where e.event_name in('project_click','service_click')),0) discovery_clicks,
coalesce(count(e.*) filter(where e.event_name='like'),0) likes,
coalesce(count(e.*) filter(where e.event_name='save'),0) saves,
coalesce(count(distinct e.visitor_id),0) visitors,
coalesce(count(distinct e.session_id),0) sessions,
coalesce(count(distinct e.session_id) filter(where e.event_name in('project_click','service_click','like','save','open_artist','share','inquiry_start','commission_inquiry')),0) engaged_sessions
from days left join ev e on date_trunc('day',e.created_at)=days.day group by days.day order by days.day),
totals as (select (select count(*) from visitor_ids) visitors,(select count(*) from session_ids) sessions,
count(*) total_events,count(*) filter(where event_name='page_view') page_views,count(*) filter(where event_name='project_view') project_views,count(*) filter(where event_name='service_view') service_views,count(*) filter(where event_name='project_click') project_clicks,count(*) filter(where event_name='service_click') service_clicks,count(*) filter(where event_name in('project_click','service_click')) discovery_clicks,count(*) filter(where event_name='like') likes,count(*) filter(where event_name='save') saves,(select count(*) from engaged_sessions) engaged_sessions,(select count(*) from repeat_visitors) repeat_visitors from ev),
pages as (select coalesce(route,'/') route,count(*) views,count(distinct visitor_id) visitors from ev where event_name='page_view' group by 1 order by views desc limit 20),
projects as (select e.entity_id id,max(p.title) title,max(e.category) category,count(*) filter(where e.event_name='project_view') views,count(*) filter(where e.event_name='project_click') clicks,count(*) filter(where e.event_name='like') likes,count(*) filter(where e.event_name='save') saves,count(distinct e.visitor_id) unique_visitors from ev e left join public.projects p on p.id=e.entity_id where e.entity_type='project' and e.entity_id is not null group by e.entity_id order by clicks desc,unique_visitors desc,views desc limit 20),
services as (select e.entity_id id,max(s.title) title,max(e.category) category,count(*) filter(where e.event_name='service_view') views,count(*) filter(where e.event_name='service_click') clicks,count(distinct e.visitor_id) unique_visitors from ev e left join public.services s on s.id=e.entity_id where e.entity_type='service' and e.entity_id is not null group by e.entity_id order by clicks desc,unique_visitors desc,views desc limit 20),
categories as (select coalesce(category,'Uncategorized') category,count(*) filter(where event_name='project_view') project_views,count(*) filter(where event_name='service_view') service_views,count(*) filter(where event_name='project_click') project_clicks,count(*) filter(where event_name='service_click') service_clicks,count(*) filter(where event_name in('project_click','service_click')) clicks,count(*) filter(where event_name in('project_view','project_click','service_view','service_click','like','save')) engagement from ev where category is not null group by 1 order by clicks desc,engagement desc limit 20),
sources as (select coalesce(nullif(max(referrer),''),'Direct / unknown') source,count(distinct session_id) sessions,count(distinct visitor_id) visitors,count(*) page_views from ev where event_name='page_view' group by coalesce(nullif(referrer,''),'Direct / unknown') order by sessions desc limit 15),
devices as (select coalesce(device_type,'Unknown') device,count(distinct session_id) sessions,count(distinct visitor_id) visitors,count(*) page_views from ev where event_name='page_view' group by 1 order by sessions desc),
commission as (select count(*) inquiries,count(*) filter(where status in('accepted','paid','completed')) qualified,count(*) filter(where status in('paid','completed')) paid,coalesce(sum(case when status in('paid','completed') then coalesce(total_amount,amount,0) else 0 end),0) revenue,coalesce(sum(case when status not in('declined','archived','paid','completed') then coalesce(total_amount,amount,0) else 0 end),0) pipeline from public.commissions,bounds where created_at>=bounds.since),
top_artists as (select p.id,p.display_name,p.username,count(*) filter(where e.event_name in('project_view','project_click','service_view','service_click')) engagement,count(distinct e.visitor_id) visitors from ev e join public.profiles p on p.id=e.user_id where p.account_type='member' group by p.id order by engagement desc limit 15),
summary as (select coalesce((select avg(event_count) from session_counts),0) avg_events_per_session)
select jsonb_build_object('days',p_days,'totals',(select to_jsonb(totals) from totals),'daily',coalesce((select jsonb_agg(daily) from daily),'[]'::jsonb),'pages',coalesce((select jsonb_agg(pages) from pages),'[]'::jsonb),'projects',coalesce((select jsonb_agg(projects) from projects),'[]'::jsonb),'services',coalesce((select jsonb_agg(services) from services),'[]'::jsonb),'categories',coalesce((select jsonb_agg(categories) from categories),'[]'::jsonb),'sources',coalesce((select jsonb_agg(sources) from sources),'[]'::jsonb),'devices',coalesce((select jsonb_agg(devices) from devices),'[]'::jsonb),'commission',(select to_jsonb(commission) from commission),'top_artists',coalesce((select jsonb_agg(top_artists) from top_artists),'[]'::jsonb),'quality',(select jsonb_build_object('avg_events_per_session',avg_events_per_session) from summary)) into result;
return result;
end; $$;
revoke all on function public.admin_analytics(integer) from public, anon;
grant execute on function public.admin_analytics(integer) to authenticated;
