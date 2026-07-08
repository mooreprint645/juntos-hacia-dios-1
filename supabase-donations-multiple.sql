-- Ejecuta este archivo en Supabase > SQL Editor.
-- Permite agregar, editar, ocultar y eliminar varias opciones de donación.

create table if not exists public.donation_settings (
  id uuid primary key default gen_random_uuid(),
  bank_name text,
  account_holder text,
  account_number text,
  account_type text,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.donation_settings
  add column if not exists label text,
  add column if not exists instructions text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true;

alter table public.donation_settings enable row level security;

grant select on table public.donation_settings to anon, authenticated;
grant insert, update, delete on table public.donation_settings to authenticated;

drop policy if exists "Public can read donations" on public.donation_settings;
drop policy if exists "Admin can insert donations" on public.donation_settings;
drop policy if exists "Admin can update donations" on public.donation_settings;
drop policy if exists "Admin can delete donations" on public.donation_settings;

create policy "Public can read donations"
on public.donation_settings
for select
to anon, authenticated
using (coalesce(is_active, true) = true or auth.role() = 'authenticated');

create policy "Admin can insert donations"
on public.donation_settings
for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
);

create policy "Admin can update donations"
on public.donation_settings
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
);

create policy "Admin can delete donations"
on public.donation_settings
for delete
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
);

update public.donation_settings
set label = coalesce(label, bank_name, account_type, 'Opción de donación'),
    is_active = coalesce(is_active, true),
    sort_order = coalesce(sort_order, 0)
where label is null or sort_order is null or is_active is null;
