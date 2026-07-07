-- Ejecuta este archivo después de supabase-artists-scale.sql.
-- Canciones y resumen de cada perfil de artista sin descargar toda su discografía.

create or replace function public.search_artist_songs_catalog(
  p_artist_id uuid,
  p_query text default null,
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
  with filtered as (
    select
      s.id,
      s.title,
      s.slug,
      s.tone,
      s.song_type,
      s.difficulty,
      coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'artist_type', to_jsonb(a) ->> 'artist_type') order by lower(a.name))
        from public.song_artists sa
        join public.artists a on a.id = sa.artist_id
        where sa.song_id = s.id
      ), '[]'::jsonb) as artists,
      coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) order by lower(c.name))
        from public.song_categories sc
        join public.categories c on c.id = sc.category_id
        where sc.song_id = s.id
      ), '[]'::jsonb) as categories,
      coalesce((
        select jsonb_agg(jsonb_build_object('id', al.id, 'title', al.title, 'slug', al.slug) order by lower(al.title))
        from public.album_songs als
        join public.albums al on al.id = als.album_id
        where als.song_id = s.id
      ), '[]'::jsonb) as albums
    from public.songs s
    where exists (
      select 1 from public.song_artists own
      where own.song_id = s.id and own.artist_id = p_artist_id
    )
    and (
      nullif(btrim(coalesce(p_query, '')), '') is null
      or coalesce(s.title, '') ilike '%' || btrim(p_query) || '%'
      or coalesce(s.tone, '') ilike '%' || btrim(p_query) || '%'
      or coalesce(s.difficulty, '') ilike '%' || btrim(p_query) || '%'
      or coalesce(s.song_type, '') ilike '%' || btrim(p_query) || '%'
      or exists (
        select 1
        from public.song_categories sc
        join public.categories c on c.id = sc.category_id
        where sc.song_id = s.id
          and coalesce(c.name, '') ilike '%' || btrim(p_query) || '%'
      )
    )
  )
  select f.id, f.title, f.slug, f.tone, f.song_type, f.difficulty, f.artists, f.categories, f.albums, count(*) over () as total_count
  from filtered f
  order by lower(f.title), f.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_artist_profile_summary(p_artist_id uuid)
returns table (
  song_count bigint,
  collaboration_count bigint,
  album_count bigint,
  categories jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with own_songs as (
    select distinct sa.song_id
    from public.song_artists sa
    where sa.artist_id = p_artist_id
  ),
  category_counts as (
    select sc.category_id, count(distinct sc.song_id)::bigint as song_count
    from own_songs own
    join public.song_categories sc on sc.song_id = own.song_id
    group by sc.category_id
  )
  select
    (select count(*)::bigint from own_songs) as song_count,
    (select count(*)::bigint from own_songs own where exists (
      select 1 from public.song_artists other
      where other.song_id = own.song_id and other.artist_id <> p_artist_id
    )) as collaboration_count,
    (select count(*)::bigint from public.albums al where al.artist_id = p_artist_id) as album_count,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'song_count', cc.song_count) order by cc.song_count desc, lower(c.name))
      from category_counts cc
      join public.categories c on c.id = cc.category_id
    ), '[]'::jsonb) as categories;
$$;

grant execute on function public.search_artist_songs_catalog(uuid, text, integer, integer) to anon, authenticated;
grant execute on function public.get_artist_profile_summary(uuid) to anon, authenticated;
