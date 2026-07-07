-- Ejecuta este archivo UNA vez en Supabase > SQL Editor.
-- Optimiza perfiles de artista, colaboradores y artistas relacionados.

create index if not exists song_artists_artist_song_idx
  on public.song_artists (artist_id, song_id);

create index if not exists song_artists_song_artist_idx
  on public.song_artists (song_id, artist_id);

create index if not exists song_categories_song_category_idx
  on public.song_categories (song_id, category_id);

create index if not exists song_categories_category_song_idx
  on public.song_categories (category_id, song_id);

create index if not exists artists_slug_idx
  on public.artists (slug);

create index if not exists artists_artist_type_idx
  on public.artists (artist_type);

-- Calcula colaboradores y artistas relacionados dentro de la base de datos,
-- sin mandar todas las relaciones al celular del visitante.
create or replace function public.jhd_artist_discovery(
  p_artist_id uuid,
  p_limit integer default 5
)
returns table (
  relation_kind text,
  artist_id uuid,
  artist_name text,
  artist_slug text,
  artist_type text,
  artist_bio text,
  artist_description text,
  shared_songs integer,
  shared_categories integer,
  same_type boolean,
  score integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with settings as (
    select greatest(1, least(coalesce(p_limit, 5), 12)) as max_items
  ),
  current_artist as (
    select id, artist_type
    from public.artists
    where id = p_artist_id
  ),
  own_songs as (
    select distinct sa.song_id
    from public.song_artists sa
    where sa.artist_id = p_artist_id
  ),
  own_categories as (
    select distinct sc.category_id
    from public.song_categories sc
    join own_songs os on os.song_id = sc.song_id
  ),
  collaborator_counts as (
    select
      sa.artist_id,
      count(distinct sa.song_id)::integer as shared_songs
    from public.song_artists sa
    join own_songs os on os.song_id = sa.song_id
    where sa.artist_id <> p_artist_id
    group by sa.artist_id
  ),
  category_counts as (
    select
      sa.artist_id,
      count(distinct sc.category_id)::integer as shared_categories
    from public.song_categories sc
    join own_categories oc on oc.category_id = sc.category_id
    join public.song_artists sa on sa.song_id = sc.song_id
    where sa.artist_id <> p_artist_id
    group by sa.artist_id
  ),
  same_type_artists as (
    select a.id as artist_id, true as same_type
    from public.artists a
    join current_artist ca on ca.artist_type is not null and a.artist_type = ca.artist_type
    where a.id <> p_artist_id
  ),
  candidates as (
    select
      coalesce(cc.artist_id, cat.artist_id, sta.artist_id) as artist_id,
      coalesce(cc.shared_songs, 0) as shared_songs,
      coalesce(cat.shared_categories, 0) as shared_categories,
      coalesce(sta.same_type, false) as same_type
    from collaborator_counts cc
    full join category_counts cat on cat.artist_id = cc.artist_id
    full join same_type_artists sta on sta.artist_id = coalesce(cc.artist_id, cat.artist_id)
  ),
  joined as (
    select
      a.id as artist_id,
      a.name as artist_name,
      a.slug as artist_slug,
      a.artist_type,
      a.bio as artist_bio,
      a.description as artist_description,
      c.shared_songs,
      c.shared_categories,
      c.same_type,
      (c.shared_songs * 100 + c.shared_categories * 10 + case when c.same_type then 1 else 0 end)::integer as score
    from candidates c
    join public.artists a on a.id = c.artist_id
  ),
  collaborators as (
    select
      'collaborator'::text as relation_kind,
      artist_id, artist_name, artist_slug, artist_type, artist_bio, artist_description,
      shared_songs, shared_categories, same_type, score,
      row_number() over (order by shared_songs desc, artist_name asc) as position
    from joined
    where shared_songs > 0
  ),
  related as (
    select
      'related'::text as relation_kind,
      artist_id, artist_name, artist_slug, artist_type, artist_bio, artist_description,
      shared_songs, shared_categories, same_type, score,
      row_number() over (order by score desc, artist_name asc) as position
    from joined
    where shared_categories > 0 or same_type
  )
  select
    relation_kind,
    artist_id,
    artist_name,
    artist_slug,
    artist_type,
    artist_bio,
    artist_description,
    shared_songs,
    shared_categories,
    same_type,
    score
  from collaborators, settings
  where collaborators.position <= settings.max_items

  union all

  select
    relation_kind,
    artist_id,
    artist_name,
    artist_slug,
    artist_type,
    artist_bio,
    artist_description,
    shared_songs,
    shared_categories,
    same_type,
    score
  from related, settings
  where related.position <= settings.max_items;
$$;

grant execute on function public.jhd_artist_discovery(uuid, integer) to anon, authenticated;

analyze public.song_artists;
analyze public.song_categories;
analyze public.artists;
