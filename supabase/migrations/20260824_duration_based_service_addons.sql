-- Duration-based service add-ons are stored in the existing services.add_ons JSONB column.
-- Normalize the existing MV Simple example so it is calculated automatically.
update public.services
set add_ons = (
  select coalesce(jsonb_agg(
    case
      when coalesce(elem->>'title','') ilike 'Video over 3 minutes will be charged +$10/30 sec'
           and coalesce(elem->>'type','') <> 'duration'
      then jsonb_build_object(
        'title', elem->>'title',
        'price', 10,
        'type', 'duration',
        'threshold_seconds', 180,
        'unit_seconds', 30
      )
      else elem
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(public.services.add_ons, '[]'::jsonb)) elem
),
updated_at = now()
where jsonb_typeof(add_ons) = 'array'
  and add_ons::text ilike '%Video over 3 minutes will be charged +$10/30 sec%';
