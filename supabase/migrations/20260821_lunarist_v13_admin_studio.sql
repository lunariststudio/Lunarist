-- Lunarist v1.3 Admin Studio
-- Additive migration only.

create index if not exists discovery_events_type_created_idx
  on public.discovery_events(event_type, created_at desc);

create index if not exists projects_status_featured_idx
  on public.projects(status, featured, updated_at desc);

-- Admin Studio reads are governed by existing is_admin RLS.
-- No service-role access is added to the browser.
