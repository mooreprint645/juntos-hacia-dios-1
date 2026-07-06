-- Ejecuta este archivo en Supabase > SQL Editor.
-- Cambia el correo si tu cuenta administradora usa otro correo.

create or replace function public.jhd_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'mooreprint645@gmail.com';
$$;

alter table public.songs enable row level security;
alter table public.artists enable row level security;
alter table public.categories enable row level security;
alter table public.albums enable row level security;
alter table public.song_artists enable row level security;
alter table public.song_categories enable row level security;
alter table public.album_songs enable row level security;
alter table public.song_links enable row level security;
alter table public.song_capo_versions enable row level security;
alter table public.donation_settings enable row level security;

-- Lectura pública para el cancionero.
create policy "jhd_read_songs" on public.songs for select using (true);
create policy "jhd_read_artists" on public.artists for select using (true);
create policy "jhd_read_categories" on public.categories for select using (true);
create policy "jhd_read_albums" on public.albums for select using (true);
create policy "jhd_read_song_artists" on public.song_artists for select using (true);
create policy "jhd_read_song_categories" on public.song_categories for select using (true);
create policy "jhd_read_album_songs" on public.album_songs for select using (true);
create policy "jhd_read_song_links" on public.song_links for select using (true);
create policy "jhd_read_song_capo_versions" on public.song_capo_versions for select using (true);
create policy "jhd_read_donation_settings" on public.donation_settings for select using (true);

-- Escritura solo para la cuenta administradora autenticada.
create policy "jhd_admin_songs" on public.songs for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_artists" on public.artists for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_categories" on public.categories for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_albums" on public.albums for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_song_artists" on public.song_artists for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_song_categories" on public.song_categories for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_album_songs" on public.album_songs for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_song_links" on public.song_links for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_song_capo_versions" on public.song_capo_versions for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
create policy "jhd_admin_donation_settings" on public.donation_settings for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin());
