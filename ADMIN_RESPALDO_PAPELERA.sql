-- Ejecuta este archivo UNA vez en Supabase > SQL Editor.
-- Agrega una papelera segura para recuperar elementos eliminados desde Admin.

begin;

create table if not exists public.admin_trash (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('artist', 'category', 'album', 'song')),
  original_id uuid not null,
  item_name text not null,
  snapshot jsonb not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now()
);

create index if not exists admin_trash_deleted_at_idx
  on public.admin_trash (deleted_at desc);

create index if not exists admin_trash_item_idx
  on public.admin_trash (item_type, original_id);

alter table public.admin_trash enable row level security;

drop policy if exists "JHD admin trash access" on public.admin_trash;

create policy "JHD admin trash access"
  on public.admin_trash
  for all
  to authenticated
  using (public.jhd_is_admin())
  with check (public.jhd_is_admin());

grant select, insert, update, delete on public.admin_trash to authenticated;

commit;
