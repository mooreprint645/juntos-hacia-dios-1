-- Ejecuta este archivo en Supabase > SQL Editor.
-- Catálogo de álbumes paginado y conteos de categorías calculados en servidor.

create index if not exists albums_lower_title_idx on public.albums ((lower(title)));
create index if not exists albums_artist_title_idx on public.albums (artist_id, title);
create index if not exists song_categories_category_song_idx on public.song_categories (category_id, song_id);

create or replace function public.search_albums_catalog(
  p_query text default null,
  p_artist_id uuid default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  slug text,
  description text,
  year text,
  artist_id uuid,
  artist_name text,
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
      al.id,
      coalesce(al.title, '')::text as title,
      coalesce(al.slug, '')::text as slug,
      coalesce(to_jsonb(al) ->> 'description', '')::text as description,
      coalesce(to_jsonb(al) ->> 'year', '')::text as year,
      al.artist_id,
      coalesce(ar.name, '')::text as artist_name,
      count(distinct als.song_id)::bigint as song_count
    from public.albums al
    left join public.artists ar on ar.id = al.artist_id
    left join public.album_songs als on als.album_id = al.id
    where
      (p_artist_id is null or al.artist_id = p_artist_id)
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or concat_ws(' ', al.title, to_jsonb(al) ->> 'description', to_jsonb(al) ->> 'year', ar.name)
          ilike '%' || btrim(p_query) || '%'
      )
    group by al.id, ar.id
  )
  select f.id, f.title, f.slug, f.description, f.year, f.artist_id, f.artist_name, f.song_count, count(*) over () as total_count
  from filtered f
  order by lower(f.title), f.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_categories_catalog()
returns table (
  id uuid,
  name text,
  slug text,
  parent_id uuid,
  song_type text,
  description text,
  sort_order integer,
  song_count bigint,
  child_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with recursive category_tree(root_id, descendant_id, path) as (
    select c.id, c.id, array[c.id]
    from public.categories c
    union all
    select tree.root_id, child.id, tree.path || child.id
    from category_tree tree
    join public.categories child on child.parent_id = tree.descendant_id
    where not child.id = any(tree.path)
  ),
  song_counts as (
    select tree.root_id, count(distinct sc.song_id)::bigint as song_count
    from category_tree tree
    left join public.song_categories sc on sc.category_id = tree.descendant_id
    group by tree.root_id
  ),
  child_counts as (
    select parent_id, count(*)::bigint as child_count
    from public.categories
    where parent_id is not null
    group by parent_id
  )
  select
    c.id,
    coalesce(c.name, '')::text as name,
    coalesce(c.slug, '')::text as slug,
    c.parent_id,
    coalesce(c.song_type, '')::text as song_type,
    coalesce(to_jsonb(c) ->> 'description', '')::text as description,
    coalesce(c.sort_order, 0)::integer as sort_order,
    coalesce(sc.song_count, 0)::bigint as song_count,
    coalesce(cc.child_count, 0)::bigint as child_count
  from public.categories c
  left join song_counts sc on sc.root_id = c.id
  left join child_counts cc on cc.parent_id = c.id
  order by coalesce(c.sort_order, 0), lower(c.name), c.id;
$$;

grant execute on function public.search_albums_catalog(text, uuid, integer, integer) to anon, authenticated;
grant execute on function public.get_categories_catalog() to anon, authenticated;
