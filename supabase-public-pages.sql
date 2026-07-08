-- Ejecuta este archivo en Supabase > SQL Editor.
-- Permite editar la página pública "Acerca de" desde Admin.

create table if not exists public.site_content (
  content_key text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

grant select on table public.site_content to anon, authenticated;
grant insert, update on table public.site_content to authenticated;

drop policy if exists "Public can read site content" on public.site_content;
drop policy if exists "Admin can insert site content" on public.site_content;
drop policy if exists "Admin can update site content" on public.site_content;

create policy "Public can read site content"
on public.site_content
for select
to anon, authenticated
using (true);

create policy "Admin can insert site content"
on public.site_content
for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
);

create policy "Admin can update site content"
on public.site_content
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
);

insert into public.site_content (content_key, content)
values ('about', '{}'::jsonb)
on conflict (content_key) do nothing;
