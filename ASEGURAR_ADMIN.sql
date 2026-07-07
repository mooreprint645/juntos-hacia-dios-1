-- Ejecuta este archivo UNA vez en Supabase > SQL Editor.
-- Mantiene el cancionero público para lectura y limita cualquier cambio
-- a la cuenta autenticada con el correo autorizado.

begin;

create or replace function public.jhd_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'spiblack0@gmail.com';
$$;

revoke all on function public.jhd_is_admin() from public;
grant execute on function public.jhd_is_admin() to anon, authenticated;

do $$
declare
  table_name text;
  policy_row record;
  tables text[] := array[
    'artists',
    'categories',
    'albums',
    'songs',
    'song_artists',
    'song_categories',
    'album_songs',
    'song_links',
    'song_capo_versions',
    'donation_settings',
    'artist_featured_songs'
  ];
begin
  foreach table_name in array tables loop
    execute format('alter table public.%I enable row level security', table_name);

    -- Se eliminan políticas anteriores que permitían modificar datos.
    -- Las políticas de lectura se conservan; abajo se garantiza una lectura pública.
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
    end loop;

    execute format('drop policy if exists %I on public.%I', 'JHD public read', table_name);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      'JHD public read', table_name
    );

    execute format('drop policy if exists %I on public.%I', 'JHD admin writes', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.jhd_is_admin()) with check (public.jhd_is_admin())',
      'JHD admin writes', table_name
    );
  end loop;
end $$;

commit;
