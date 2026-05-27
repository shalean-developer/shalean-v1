-- RLS for booking_series: dashboards use authenticated server clients; engine writes via service_role.

alter table public.booking_series enable row level security;
drop policy if exists booking_series_select_admin on public.booking_series;
create policy booking_series_select_admin on public.booking_series
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists booking_series_select_customer on public.booking_series;
create policy booking_series_select_customer on public.booking_series
  for select to authenticated
  using (customer_id = public.auth_customer_id());
drop policy if exists booking_series_admin_write on public.booking_series;
create policy booking_series_admin_write on public.booking_series
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
grant select on public.booking_series to authenticated, service_role;
grant insert, update on public.booking_series to service_role;
comment on table public.booking_series is
  'Materialized recurring cadence after first paid booking. Admin: read/write. Customer: read own series. Engine/cron: service_role.';
