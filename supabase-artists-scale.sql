-- Ejecuta este archivo en Supabase > SQL Editor.
-- Catálogo de artistas paginado y con conteo de canciones desde el servidor.

create index if not exists artists_lower_name_idx on public.artists ((lower(name)));
create index if not exists song_artists_artist_song_idx on public.song_artists (artist_id, song_id);

create or replace function public.search_artists_catalog(
  p_query text default null,
  p_artist_type text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  artist_type text,
  bio text,
  description text,
  song_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      a.id,
      coalesce(a.name, '')::text as name,
      coalesce(a.slug, '')::text as slug,
      coalesce(to_jsonb(a) ->> 'artist_type', to_jsonb(a) ->> 'type', '')::text as artist_type,
      coalesce(to_jsonb(a) ->> 'bio', '')::text as bio,
      coalesce(to_jsonb(a) ->> 'description', '')::text as description,
      count(distinct sa.song_id)::bigint as song_count
    from public.artists a
    left join public.song_artists sa on sa.artist_id = a.id
    where
      (
        nullif(btrim(coalesce(p_artist_type, '')), '') is null
        or translate(lower(coalesce(to_jsonb(a) ->> 'artist_type', to_jsonb(a) ->> 'type', '')), 'áéíóúü', 'aeiouu')
          = translate(lower(btrim(p_artist_type)), 'áéíóúü', 'aeiouu')
      )
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or concat_ws(' ', a.name, to_jsonb(a) ->> 'bio', to_jsonb(a) ->> 'description', to_jsonb(a) ->> 'artist_type', to_jsonb(a) ->> 'type')
          ilike '%' || btrim(p_query) || '%'
      )
    group by a.id
  )
  select f.id, f.name, f.slug, f.artist_type, f.bio, f.description, f.song_count, count(*) over () as total_count
  from filtered f
  order by lower(f.name), f.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_artists_catalog(text, text, integer, integer) to anon, authenticated;
