-- Stage 7B-1a: Hourly assignment funnel telemetry rollups (admin SELECT, service_role upsert).

create table if not exists public.assignment_metrics_hourly (
  bucket_start timestamptz primary key,

  offers_created_count integer not null default 0 check (offers_created_count >= 0),
  offers_accepted_count integer not null default 0 check (offers_accepted_count >= 0),
  offers_declined_count integer not null default 0 check (offers_declined_count >= 0),
  offers_expired_count integer not null default 0 check (offers_expired_count >= 0),
  offers_cancelled_count integer not null default 0 check (offers_cancelled_count >= 0),
  bookings_assigned_count integer not null default 0 check (bookings_assigned_count >= 0),
  redispatch_booking_count integer not null default 0 check (redispatch_booking_count >= 0),
  max_attempts_booking_count integer not null default 0 check (max_attempts_booking_count >= 0),
  admin_intervention_count integer not null default 0 check (admin_intervention_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.assignment_metrics_hourly is
  'Hourly assignment funnel counters. No PII. Admin SELECT only (7B-1a).';
create index if not exists idx_assignment_metrics_hourly_bucket_desc
  on public.assignment_metrics_hourly (bucket_start desc);
alter table public.assignment_metrics_hourly enable row level security;
drop policy if exists assignment_metrics_hourly_select_admin on public.assignment_metrics_hourly;
create policy assignment_metrics_hourly_select_admin on public.assignment_metrics_hourly
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.assignment_metrics_hourly to authenticated, service_role;
grant insert, update on public.assignment_metrics_hourly to service_role;
