-- Keep public donation reads independent from the admin membership helper.
-- This prevents anonymous requests from requiring EXECUTE on jhd_is_admin().

drop policy if exists "Public can read active donations"
  on public.donation_settings;
drop policy if exists "Admin can read all donations"
  on public.donation_settings;

create policy "Public can read active donations"
  on public.donation_settings
  for select
  to anon, authenticated
  using (coalesce(is_active, true));

create policy "Admin can read all donations"
  on public.donation_settings
  for select
  to authenticated
  using ((select public.jhd_is_admin()));
