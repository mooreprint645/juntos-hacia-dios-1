-- Prevent future invalid catalog data after existing rows were verified clean.

alter table public.songs
  add constraint songs_title_nonempty check (btrim(title) <> ''),
  add constraint songs_slug_nonempty check (btrim(slug) <> ''),
  add constraint songs_capo_position_nonnegative check (capo_position >= 0),
  add constraint songs_song_type_allowed check (
    song_type in ('catolico', 'cristiano', 'mixto')
  );

alter table public.song_artists
  add constraint song_artists_role_allowed check (
    role in ('principal', 'colaborador')
  );

alter table public.song_links
  add constraint song_links_title_nonempty check (btrim(title) <> ''),
  add constraint song_links_url_nonempty check (btrim(url) <> '');

alter table public.song_capo_versions
  add constraint song_capo_versions_position_positive check (capo_position > 0),
  add constraint song_capo_versions_key_nonempty check (btrim(capo_key) <> '');
