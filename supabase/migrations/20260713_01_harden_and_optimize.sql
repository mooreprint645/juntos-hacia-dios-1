-- Juntos Hacia Dios: hardening and performance cleanup
-- Safe, repeatable migration. No application data is deleted.

begin;

-- Pin function search paths to prevent object shadowing.
alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function public.get_or_create_category(text, text, text, text, uuid, integer)
  set search_path = pg_catalog, public;
alter function public.jhd_default_artist_type() set search_path = pg_catalog, public;

-- Keep the admin helper callable only by authenticated sessions.
revoke all on function public.jhd_is_admin() from public;
revoke all on function public.jhd_is_admin() from anon;
grant execute on function public.jhd_is_admin() to authenticated;

-- Cover foreign keys used by joins and cascading maintenance.
create index if not exists admin_trash_deleted_by_idx
  on public.admin_trash (deleted_by);
create index if not exists artist_featured_songs_song_id_idx
  on public.artist_featured_songs (song_id);
create index if not exists songs_artist_id_idx
  on public.songs (artist_id);
create index if not exists songs_category_id_idx
  on public.songs (category_id);

-- Remove one duplicate slug index while preserving equivalent coverage.
drop index if exists public.artists_slug_idx;

-- Consolidate duplicate policies on the public catalog.
do $cleanup$
declare
  target_table text;
  old_policy text;
begin
  foreach target_table in array array[
    'album_songs', 'albums', 'artist_featured_songs', 'artists', 'categories',
    'song_artists', 'song_capo_versions', 'song_categories', 'song_links', 'songs'
  ]
  loop
    foreach old_policy in array array[
      'JHD admin writes', 'JHD admin insert', 'JHD admin update', 'JHD admin delete',
      'Public can read ' || target_table,
      'Public can read ' || replace(target_table, '_', ' '),
      'jhd_read_' || target_table
    ]
    loop
      execute format('drop policy if exists %I on public.%I', old_policy, target_table);
    end loop;

    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.jhd_is_admin()))',
      'JHD admin insert', target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.jhd_is_admin())) with check ((select public.jhd_is_admin()))',
      'JHD admin update', target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.jhd_is_admin()))',
      'JHD admin delete', target_table
    );
  end loop;
end
$cleanup$;

-- Home recommendations: one public read policy plus centralized admin writes.
drop policy if exists "Authorized admin manages home recommendations" on public.home_recommendations;
create policy "Authorized admin manages home recommendations"
  on public.home_recommendations
  for all
  to authenticated
  using ((select public.jhd_is_admin()))
  with check ((select public.jhd_is_admin()));

-- Site content: public reads remain unchanged; writes use the admin table.
drop policy if exists "Admin can insert site content" on public.site_content;
create policy "Admin can insert site content"
  on public.site_content
  for insert
  to authenticated
  with check ((select public.jhd_is_admin()));

drop policy if exists "Admin can update site content" on public.site_content;
create policy "Admin can update site content"
  on public.site_content
  for update
  to authenticated
  using ((select public.jhd_is_admin()))
  with check ((select public.jhd_is_admin()));

-- Contact-message administration uses the same central authorization source.
drop policy if exists "Admin can read contact messages" on public.contact_messages;
create policy "Admin can read contact messages"
  on public.contact_messages
  for select
  to authenticated
  using ((select public.jhd_is_admin()));

drop policy if exists "Admin can update contact messages" on public.contact_messages;
create policy "Admin can update contact messages"
  on public.contact_messages
  for update
  to authenticated
  using ((select public.jhd_is_admin()))
  with check ((select public.jhd_is_admin()));

drop policy if exists "Admin can delete contact messages" on public.contact_messages;
create policy "Admin can delete contact messages"
  on public.contact_messages
  for delete
  to authenticated
  using ((select public.jhd_is_admin()));

commit;
