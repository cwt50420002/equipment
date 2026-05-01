/*
 * Paste ONLY this block into Dashboard -> SQL -> New query, then Run.
 * Tighten RLS policies before production (Auth + restricted writes).
 */

create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_select_anon" on public.app_state;
drop policy if exists "app_state_insert_anon" on public.app_state;
drop policy if exists "app_state_update_anon" on public.app_state;

create policy "app_state_select_anon" on public.app_state
  for select using (true);

create policy "app_state_insert_anon" on public.app_state
  for insert with check (true);

create policy "app_state_update_anon" on public.app_state
  for update using (true);
