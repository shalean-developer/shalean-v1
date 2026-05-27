-- Phase 5B: Customer recurring change requests (support queue; no auto-execution).

create table if not exists public.recurring_series_requests (
  id uuid primary key default gen_random_uuid(),

  series_id uuid not null references public.booking_series (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,

  request_type text not null check (request_type in ('pause', 'cancel', 'reschedule')),
  note text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),

  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);
comment on table public.recurring_series_requests is
  'Customer-requested recurring schedule changes. Admin acts manually; requests are never auto-executed.';
create index if not exists idx_recurring_series_requests_series_status
  on public.recurring_series_requests (series_id, status, created_at desc);
create index if not exists idx_recurring_series_requests_open
  on public.recurring_series_requests (status, created_at desc)
  where status in ('open', 'acknowledged');
alter table public.recurring_series_requests enable row level security;
drop policy if exists recurring_series_requests_select_admin on public.recurring_series_requests;
create policy recurring_series_requests_select_admin on public.recurring_series_requests
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists recurring_series_requests_select_customer on public.recurring_series_requests;
create policy recurring_series_requests_select_customer on public.recurring_series_requests
  for select to authenticated
  using (customer_id = public.auth_customer_id());
drop policy if exists recurring_series_requests_insert_customer on public.recurring_series_requests;
create policy recurring_series_requests_insert_customer on public.recurring_series_requests
  for insert to authenticated
  with check (customer_id = public.auth_customer_id());
drop policy if exists recurring_series_requests_update_admin on public.recurring_series_requests;
create policy recurring_series_requests_update_admin on public.recurring_series_requests
  for update to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
grant select, insert on public.recurring_series_requests to authenticated, service_role;
grant update on public.recurring_series_requests to authenticated, service_role;
grant insert on public.recurring_series_requests to service_role;
