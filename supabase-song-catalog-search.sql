-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.
-- Búsqueda y paginación escalables para el catálogo público de canciones.
-- La página solicitará solo 24 canciones por vez, incluso con miles de registros.

create index if not exists songs_song_type_title_idx
  on public.songs (song_type, title);

create index if not exists songs_lower_title_idx
  on public.songs ((lower(title)));

create index if not exists categories_parent_id_idx
  on public.categories (parent_id);

create index if not exists song_artists_song_artist_idx
  on public.song_artists (song_id, artist_id);

create index if not exists song_artists_artist_song_idx
  on public.song_artists (artist_id, song_id);

create index if not exists song_categories_song_category_idx
  on public.song_categories (song_id, category_id);

create index if not exists song_categories_category_song_idx
  on public.song_categories (category_id, song_id);

create index if not exists album_songs_song_album_idx
  on public.album_songs (song_id, album_id);

create index if not exists album_songs_album_song_idx
  on public.album_songs (album_id, song_id);

create or replace function public.search_songs_catalog(
  p_query text default null,
  p_song_type text default null,
  p_category_id uuid default null,
  p_album_id uuid default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  slug text,
  tone text,
  song_type text,
  difficulty text,
  artists jsonb,
  categories jsonb,
  albums jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with recursive category_tree(id) as (
    select c.id
    from public.categories c
    where p_category_id is not null
      and c.id = p_category_id

    union

    select child.id
    from public.categories child
    join category_tree parent on child.parent_id = parent.id
  ),
  filtered as (
    select
      s.id,
      s.title,
      s.slug,
      s.tone,
      s.song_type,
      s.difficulty,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'artist_type', a.artist_type
          )
          order by lower(a.name)
        )
        from public.song_artists sa
        join public.artists a on a.id = sa.artist_id
        where sa.song_id = s.id
      ), '[]'::jsonb) as artists,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'song_type', c.song_type,
            'slug', c.slug
          )
          order by lower(c.name)
        )
        from public.song_categories sc
        join public.categories c on c.id = sc.category_id
        where sc.song_id = s.id
      ), '[]'::jsonb) as categories,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', al.id,
            'title', al.title,
            'slug', al.slug
          )
          order by lower(al.title)
        )
        from public.album_songs als
        join public.albums al on al.id = als.album_id
        where als.song_id = s.id
      ), '[]'::jsonb) as albums
    from public.songs s
    where
      (
        nullif(btrim(coalesce(p_song_type, '')), '') is null
        or lower(coalesce(s.song_type, '')) = lower(btrim(p_song_type))
      )
      and (
        p_category_id is null
        or exists (
          select 1
          from public.song_categories sc
          where sc.song_id = s.id
            and sc.category_id in (select id from category_tree)
        )
      )
      and (
        p_album_id is null
        or exists (
          select 1
          from public.album_songs als
          where als.song_id = s.id
            and als.album_id = p_album_id
        )
      )
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or coalesce(s.title, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(s.tone, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(s.difficulty, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(s.song_type, '') ilike '%' || btrim(p_query) || '%'
        or exists (
          select 1
          from public.song_artists sa
          join public.artists a on a.id = sa.artist_id
          where sa.song_id = s.id
            and coalesce(a.name, '') ilike '%' || btrim(p_query) || '%'
        )
        or exists (
          select 1
          from public.song_categories sc
          join public.categories c on c.id = sc.category_id
          where sc.song_id = s.id
            and coalesce(c.name, '') ilike '%' || btrim(p_query) || '%'
        )
        or exists (
          select 1
          from public.album_songs als
          join public.albums al on al.id = als.album_id
          where als.song_id = s.id
            and coalesce(al.title, '') ilike '%' || btrim(p_query) || '%'
        )
      )
  )
  select
    f.id,
    f.title,
    f.slug,
    f.tone,
    f.song_type,
    f.difficulty,
    f.artists,
    f.categories,
    f.albums,
    count(*) over () as total_count
  from filtered f
  order by lower(f.title), f.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_songs_catalog(text, text, uuid, uuid, integer, integer)
  to anon, authenticated;
