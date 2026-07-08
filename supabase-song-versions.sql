-- Versiones alternativas de una canción por artista, arreglo o interpretación

create extension if not exists pgcrypto;

create table if not exists public.song_versions (
  id uuid primary key default gen_random_uuid(),
  parent_song_id uuid not null references public.songs(id) on delete cascade,
  version_song_id uuid not null references public.songs(id) on delete cascade,
  label text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint song_versions_not_same check (parent_song_id <> version_song_id),
  constraint song_versions_unique_pair unique (parent_song_id, version_song_id)
);

create index if not exists song_versions_parent_idx on public.song_versions(parent_song_id);
create index if not exists song_versions_version_idx on public.song_versions(version_song_id);

alter table public.song_versions enable row level security;

grant select on public.song_versions to anon, authenticated;
grant insert, update, delete on public.song_versions to authenticated;

drop policy if exists "Public can read song versions" on public.song_versions;
create policy "Public can read song versions"
on public.song_versions
for select
to anon, authenticated
using (true);

drop policy if exists "Admin can insert song versions" on public.song_versions;
create policy "Admin can insert song versions"
on public.song_versions
for insert
to authenticated
with check (lower(coalesce(auth.jwt() ->> 'email','')) = lower('mooreprint645@gmail.com'));

drop policy if exists "Admin can update song versions" on public.song_versions;
create policy "Admin can update song versions"
on public.song_versions
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = lower('mooreprint645@gmail.com'))
with check (lower(coalesce(auth.jwt() ->> 'email','')) = lower('mooreprint645@gmail.com'));

drop policy if exists "Admin can delete song versions" on public.song_versions;
create policy "Admin can delete song versions"
on public.song_versions
for delete
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = lower('mooreprint645@gmail.com'));
