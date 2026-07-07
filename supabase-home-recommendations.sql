-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.
-- Permite elegir manualmente qué carpetas o cantos aparecen en Inicio.

create table if not exists public.home_recommendations (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('category', 'song')),
  target_id uuid not null,
  section_type text not null check (section_type in ('catolico', 'cristiano')),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists home_recommendations_unique_target_per_section
  on public.home_recommendations (target_type, target_id, section_type);

create index if not exists home_recommendations_public_order
  on public.home_recommendations (section_type, is_visible, sort_order);

alter table public.home_recommendations enable row level security;

drop policy if exists "Public can read home recommendations" on public.home_recommendations;
create policy "Public can read home recommendations"
  on public.home_recommendations
  for select
  using (true);

drop policy if exists "Authorized admin manages home recommendations" on public.home_recommendations;
create policy "Authorized admin manages home recommendations"
  on public.home_recommendations
  for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com'))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com'));
