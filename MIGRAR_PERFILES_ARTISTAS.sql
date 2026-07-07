-- Ejecuta este archivo UNA vez en Supabase > SQL Editor.
-- Mueve la biografía, enlaces y canciones destacadas fuera de artists.description.

begin;

alter table public.artists
  add column if not exists bio text,
  add column if not exists youtube_url text,
  add column if not exists spotify_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text;

create table if not exists public.artist_featured_songs (
  artist_id uuid not null references public.artists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (artist_id, song_id)
);

create index if not exists artist_featured_songs_artist_order_idx
  on public.artist_featured_songs (artist_id, sort_order);

-- Migra la información que antes se guardaba dentro de artists.description.
with legacy as (
  select
    id,
    trim(split_part(coalesce(description, ''), '<!--JHD_ARTIST_META:', 1)) as legacy_bio,
    nullif(substring(coalesce(description, '') from '<!--JHD_ARTIST_META:(.*)-->'), '')::jsonb as meta
  from public.artists
  where position('<!--JHD_ARTIST_META:' in coalesce(description, '')) > 0
)
update public.artists as artist
set
  bio = coalesce(nullif(artist.bio, ''), nullif(legacy.legacy_bio, '')),
  youtube_url = coalesce(nullif(artist.youtube_url, ''), nullif(legacy.meta->'links'->>'youtube', '')),
  spotify_url = coalesce(nullif(artist.spotify_url, ''), nullif(legacy.meta->'links'->>'spotify', '')),
  instagram_url = coalesce(nullif(artist.instagram_url, ''), nullif(legacy.meta->'links'->>'instagram', '')),
  facebook_url = coalesce(nullif(artist.facebook_url, ''), nullif(legacy.meta->'links'->>'facebook', ''))
from legacy
where artist.id = legacy.id;

with legacy as (
  select
    id,
    nullif(substring(coalesce(description, '') from '<!--JHD_ARTIST_META:(.*)-->'), '')::jsonb as meta
  from public.artists
  where position('<!--JHD_ARTIST_META:' in coalesce(description, '')) > 0
), selected as (
  select
    legacy.id as artist_id,
    song_id.value::uuid as song_id,
    song_id.ordinality - 1 as sort_order
  from legacy
  cross join lateral jsonb_array_elements_text(coalesce(legacy.meta->'featuredSongIds', '[]'::jsonb)) with ordinality as song_id(value, ordinality)
  where song_id.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
)
insert into public.artist_featured_songs (artist_id, song_id, sort_order)
select selected.artist_id, selected.song_id, selected.sort_order
from selected
join public.songs on songs.id = selected.song_id
on conflict (artist_id, song_id) do update set sort_order = excluded.sort_order;

-- Elimina el bloque técnico anterior. La biografía ya está en artists.bio.
update public.artists
set description = null
where position('<!--JHD_ARTIST_META:' in coalesce(description, '')) > 0;

alter table public.artist_featured_songs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'artist_featured_songs' and policyname = 'Public can read artist featured songs'
  ) then
    create policy "Public can read artist featured songs"
      on public.artist_featured_songs for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'artist_featured_songs' and policyname = 'Authenticated users can manage artist featured songs'
  ) then
    create policy "Authenticated users can manage artist featured songs"
      on public.artist_featured_songs for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

grant select on public.artist_featured_songs to anon, authenticated;
grant insert, update, delete on public.artist_featured_songs to authenticated;

commit;
