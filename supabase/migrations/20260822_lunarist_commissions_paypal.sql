-- Lunarist commission inquiries + service add-ons.
-- Safe additive migration.

alter table public.services add column if not exists add_ons jsonb not null default '[]'::jsonb;

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  email text not null,
  message text not null,
  budget text default '',
  addon_titles text[] not null default '{}',
  status text not null default 'new' check (status in ('new','contacted','accepted','paid','completed','declined','archived')),
  paypal_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commissions_service_idx on public.commissions(service_id, created_at desc);
create index if not exists commissions_status_idx on public.commissions(status, created_at desc);

alter table public.commissions enable row level security;

drop policy if exists "commission owners can read inquiries" on public.commissions;
create policy "commission owners can read inquiries" on public.commissions
for select to authenticated using (
  exists(select 1 from public.services s where s.id=service_id and s.owner_id=auth.uid())
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true)
);

drop policy if exists "commission owners can update inquiries" on public.commissions;
create policy "commission owners can update inquiries" on public.commissions
for update to authenticated using (
  exists(select 1 from public.services s where s.id=service_id and s.owner_id=auth.uid())
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true)
) with check (
  exists(select 1 from public.services s where s.id=service_id and s.owner_id=auth.uid())
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true)
);

-- Inserts happen only through /api/lunarist using the server-side service role.
-- No anonymous direct INSERT policy is created.
