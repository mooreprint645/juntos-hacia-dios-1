-- Juntos Hacia Dios: remove unnecessary SECURITY DEFINER usage
-- and eliminate overlapping home recommendation policies.

begin;

-- A signed-in user may only see whether their own account is registered as admin.
grant select on table public.jhd_admin_users to authenticated;

drop policy if exists "Users can read own admin membership"
  on public.jhd_admin_users;

create policy "Users can read own admin membership"
  on public.jhd_admin_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- RLS on jhd_admin_users now provides the required isolation, so this helper
-- no longer needs owner privileges.
create or replace function public.jhd_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.jhd_admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.jhd_is_admin() from public;
revoke all on function public.jhd_is_admin() from anon;
grant execute on function public.jhd_is_admin() to authenticated;

-- Anonymous visitors need public recommendations. Authenticated administrators
-- already receive access through the admin policy, so roles must not overlap.
drop policy if exists "Public can read home recommendations"
  on public.home_recommendations;

create policy "Public can read home recommendations"
  on public.home_recommendations
  for select
  to anon
  using (true);

commit;
