/*
 * EquipCheck — relational schema for hospital equipment daily checks.
 *
 * Run in Supabase Dashboard → SQL → New query (entire file).
 * BACK UP first if you already use these tables.
 *
 * Replaces the older single-row app_state JSON approach with normalized tables.
 */

-- Tear-down (safe for re-run during development)
drop table if exists public.check_submission_items cascade;
drop table if exists public.check_submissions cascade;
drop table if exists public.equipment_items cascade;
drop table if exists public.extra_categories cascade;
drop table if exists public.locations cascade;
drop table if exists public.app_state cascade;

-- Locations / zones
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index locations_sort_order_idx on public.locations (sort_order, name);

-- Category labels added from Admin (before any equipment uses them)
create table public.extra_categories (
  name text primary key,
  created_at timestamptz not null default now()
);

-- Master equipment list (template + custom rows share this table)
create table public.equipment_items (
  id text primary key,
  location_id uuid not null references public.locations (id) on delete restrict,
  name text not null,
  category text not null,
  quantity int not null default 1,
  asset_id text not null default '',
  remark text not null default '',
  updated_at timestamptz not null default now()
);

create index equipment_items_location_idx on public.equipment_items (location_id);

-- Daily submission header (one row per checklist submit)
create table public.check_submissions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  checked_by text not null,
  submitted_at timestamptz not null default now(),
  local_date_key text not null,
  constraint check_submissions_local_date_key_chk check (local_date_key ~ '^\d{2}/\d{2}/\d{4}$')
);

create index check_submissions_location_submitted_idx
  on public.check_submissions (location_id, submitted_at desc);

create index check_submissions_date_key_idx on public.check_submissions (local_date_key);

-- Line items for each submission
create table public.check_submission_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.check_submissions (id) on delete cascade,
  equipment_item_id text references public.equipment_items (id) on delete set null,
  equipment_name text not null,
  category text,
  quantity int,
  result text not null,
  remark text not null default '',
  constraint check_submission_items_result_chk check (
    result in ('Good', 'NG', 'Leaned', 'Others')
  )
);

create index check_submission_items_submission_idx on public.check_submission_items (submission_id);

-- Row Level Security (permissive anon — tighten before production with Auth)
alter table public.locations enable row level security;
alter table public.extra_categories enable row level security;
alter table public.equipment_items enable row level security;
alter table public.check_submissions enable row level security;
alter table public.check_submission_items enable row level security;

drop policy if exists "locations_anon_all" on public.locations;
drop policy if exists "extra_categories_anon_all" on public.extra_categories;
drop policy if exists "equipment_anon_all" on public.equipment_items;
drop policy if exists "check_submissions_anon_all" on public.check_submissions;
drop policy if exists "check_submission_items_anon_all" on public.check_submission_items;

create policy "locations_anon_all" on public.locations
  for all using (true) with check (true);

create policy "extra_categories_anon_all" on public.extra_categories
  for all using (true) with check (true);

create policy "equipment_anon_all" on public.equipment_items
  for all using (true) with check (true);

create policy "check_submissions_anon_all" on public.check_submissions
  for all using (true) with check (true);

create policy "check_submission_items_anon_all" on public.check_submission_items
  for all using (true) with check (true);

-- Seed locations + equipment (matches default templates in the app)
insert into public.locations (name, sort_order) values
  ('11/F IRA Zone A', 1),
  ('11/F IRA Zone B', 2),
  ('12/F Rehab Gym', 3);

insert into public.equipment_items (id, location_id, name, category, quantity, asset_id, remark)
select v.id, l.id, v.name, v.category, v.quantity, '', ''
from (
  values
    ('11/F IRA Zone A', '11/F IRA Zone A-Walking Stick-0', 'Walking Stick', 'Mobility Aid', 1),
    ('11/F IRA Zone A', '11/F IRA Zone A-Quadripod-1', 'Quadripod', 'Mobility Aid', 2),
    ('11/F IRA Zone A', '11/F IRA Zone A-IFT Machine-2', 'IFT Machine', 'Therapy Device', 1),
    ('11/F IRA Zone A', '11/F IRA Zone A-Minipress Machine-3', 'Minipress Machine', 'Therapy Device', 1),
    ('11/F IRA Zone B', '11/F IRA Zone B-Walking Frame-0', 'Walking Frame', 'Mobility Aid', 2),
    ('11/F IRA Zone B', '11/F IRA Zone B-Portable Suction-1', 'Portable Suction', 'Suction Unit', 1),
    ('11/F IRA Zone B', '11/F IRA Zone B-Pulse Oximeter-2', 'Pulse Oximeter', 'Monitoring', 2),
    ('12/F Rehab Gym', '12/F Rehab Gym-TENS Machine-0', 'TENS Machine', 'Therapy Device', 2),
    ('12/F Rehab Gym', '12/F Rehab Gym-Treatment Couch-1', 'Treatment Couch', 'General', 3),
    ('12/F Rehab Gym', '12/F Rehab Gym-Blood Pressure Device-2', 'Blood Pressure Device', 'Monitoring', 2)
) as v(location_name, id, name, category, quantity)
join public.locations l on l.name = v.location_name;
