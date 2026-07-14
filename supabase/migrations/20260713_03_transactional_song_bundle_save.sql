-- Save a song and all of its editable relations atomically.
-- SECURITY INVOKER preserves the caller's RLS permissions.

create or replace function public.jhd_save_song_bundle(
  p_song_id uuid,
  p_song jsonb,
  p_artists jsonb default '[]'::jsonb,
  p_category_id uuid default null,
  p_album_id uuid default null,
  p_links jsonb default '[]'::jsonb,
  p_capos jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_song_id uuid;
  v_artist jsonb;
  v_link jsonb;
  v_capo jsonb;
  v_index integer := 0;
begin
  if not public.jhd_is_admin() then
    raise exception 'Acceso administrativo requerido' using errcode = '42501';
  end if;

  if nullif(btrim(p_song->>'title'), '') is null then
    raise exception 'El título es obligatorio' using errcode = '22023';
  end if;

  if nullif(btrim(p_song->>'slug'), '') is null then
    raise exception 'El slug es obligatorio' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_artists, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_artists, '[]'::jsonb)) = 0 then
    raise exception 'Selecciona al menos un artista' using errcode = '22023';
  end if;

  if p_song_id is null then
    insert into public.songs (
      title, slug, song_type, tone, lyrics, difficulty,
      capo_position, capo_key, artist_id, category_id
    ) values (
      btrim(p_song->>'title'),
      btrim(p_song->>'slug'),
      coalesce(nullif(btrim(p_song->>'song_type'), ''), 'catolico'),
      nullif(btrim(p_song->>'tone'), ''),
      coalesce(p_song->>'lyrics', ''),
      nullif(btrim(p_song->>'difficulty'), ''),
      greatest(coalesce((p_song->>'capo_position')::integer, 0), 0),
      nullif(btrim(p_song->>'capo_key'), ''),
      nullif(p_artists->0->>'artist_id', '')::uuid,
      p_category_id
    ) returning id into v_song_id;
  else
    update public.songs
       set title = btrim(p_song->>'title'),
           slug = btrim(p_song->>'slug'),
           song_type = coalesce(nullif(btrim(p_song->>'song_type'), ''), 'catolico'),
           tone = nullif(btrim(p_song->>'tone'), ''),
           lyrics = coalesce(p_song->>'lyrics', ''),
           difficulty = nullif(btrim(p_song->>'difficulty'), ''),
           capo_position = greatest(coalesce((p_song->>'capo_position')::integer, 0), 0),
           capo_key = nullif(btrim(p_song->>'capo_key'), ''),
           artist_id = nullif(p_artists->0->>'artist_id', '')::uuid,
           category_id = p_category_id,
           updated_at = now()
     where id = p_song_id
     returning id into v_song_id;

    if v_song_id is null then
      raise exception 'Canción no encontrada' using errcode = 'P0002';
    end if;
  end if;

  delete from public.song_artists where song_id = v_song_id;
  delete from public.song_categories where song_id = v_song_id;
  delete from public.album_songs where song_id = v_song_id;
  delete from public.song_links where song_id = v_song_id;
  delete from public.song_capo_versions where song_id = v_song_id;

  v_index := 0;
  for v_artist in
    select value from jsonb_array_elements(coalesce(p_artists, '[]'::jsonb))
  loop
    insert into public.song_artists (song_id, artist_id, role, sort_order)
    values (
      v_song_id,
      (v_artist->>'artist_id')::uuid,
      case when v_index = 0 then 'principal' else 'colaborador' end,
      v_index
    );
    v_index := v_index + 1;
  end loop;

  if p_category_id is not null then
    insert into public.song_categories (song_id, category_id)
    values (v_song_id, p_category_id);
  end if;

  if p_album_id is not null then
    insert into public.album_songs (song_id, album_id, sort_order)
    values (v_song_id, p_album_id, 0);
  end if;

  v_index := 0;
  for v_link in
    select value from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    if nullif(btrim(v_link->>'url'), '') is not null then
      insert into public.song_links (
        song_id, title, link_type, platform, url, sort_order
      ) values (
        v_song_id,
        coalesce(nullif(btrim(v_link->>'title'), ''), 'Enlace'),
        coalesce(nullif(btrim(v_link->>'link_type'), ''), 'Tutorial'),
        nullif(btrim(v_link->>'platform'), ''),
        btrim(v_link->>'url'),
        v_index
      );
      v_index := v_index + 1;
    end if;
  end loop;

  v_index := 0;
  for v_capo in
    select value from jsonb_array_elements(coalesce(p_capos, '[]'::jsonb))
  loop
    if coalesce((v_capo->>'capo_position')::integer, 0) > 0
       and nullif(btrim(v_capo->>'capo_key'), '') is not null then
      insert into public.song_capo_versions (
        song_id, label, capo_position, capo_key, sort_order
      ) values (
        v_song_id,
        coalesce(
          nullif(btrim(v_capo->>'label'), ''),
          'Capo ' || (v_capo->>'capo_position')
        ),
        (v_capo->>'capo_position')::integer,
        btrim(v_capo->>'capo_key'),
        v_index
      );
      v_index := v_index + 1;
    end if;
  end loop;

  return v_song_id;
end;
$$;

revoke all on function public.jhd_save_song_bundle(
  uuid, jsonb, jsonb, uuid, uuid, jsonb, jsonb
) from public;
revoke all on function public.jhd_save_song_bundle(
  uuid, jsonb, jsonb, uuid, uuid, jsonb, jsonb
) from anon;
grant execute on function public.jhd_save_song_bundle(
  uuid, jsonb, jsonb, uuid, uuid, jsonb, jsonb
) to authenticated;
