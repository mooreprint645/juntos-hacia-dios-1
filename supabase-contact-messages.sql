-- Ejecuta este archivo en Supabase > SQL Editor.
-- Guarda mensajes de contacto, reportes de corrección y solicitudes de cantos en el Admin.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  message_type text not null default 'Mensaje',
  song_title text,
  artist_name text,
  source_url text,
  details text not null,
  contact_name text,
  contact_email text,
  page_url text,
  user_agent text,
  status text not null default 'pendiente',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages
  add column if not exists message_type text not null default 'Mensaje',
  add column if not exists song_title text,
  add column if not exists artist_name text,
  add column if not exists source_url text,
  add column if not exists details text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists page_url text,
  add column if not exists user_agent text,
  add column if not exists status text not null default 'pendiente',
  add column if not exists admin_notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.contact_messages enable row level security;

grant insert on table public.contact_messages to anon, authenticated;
grant select, update, delete on table public.contact_messages to authenticated;

drop policy if exists "Anyone can send contact messages" on public.contact_messages;
drop policy if exists "Admin can read contact messages" on public.contact_messages;
drop policy if exists "Admin can update contact messages" on public.contact_messages;
drop policy if exists "Admin can delete contact messages" on public.contact_messages;

create policy "Anyone can send contact messages"
on public.contact_messages
for insert
to anon, authenticated
with check (
  char_length(btrim(coalesce(details, ''))) >= 3
  and coalesce(status, 'pendiente') = 'pendiente'
);

create policy "Admin can read contact messages"
on public.contact_messages
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
);

create policy "Admin can update contact messages"
on public.contact_messages
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
);

create policy "Admin can delete contact messages"
on public.contact_messages
for delete
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('mooreprint645@gmail.com')
);

create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages (status);
create index if not exists contact_messages_type_idx on public.contact_messages (message_type);
