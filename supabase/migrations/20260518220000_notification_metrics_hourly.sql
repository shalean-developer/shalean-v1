-- Stage 5H-b: Hourly notification worker telemetry rollups (admin SELECT, service_role upsert).

create table if not exists public.notification_metrics_hourly (
  bucket_start timestamptz primary key,

  run_count integer not null default 0 check (run_count >= 0),
  ok_run_count integer not null default 0 check (ok_run_count >= 0),
  failed_run_count integer not null default 0 check (failed_run_count >= 0),
  delivery_enabled_run_count integer not null default 0 check (delivery_enabled_run_count >= 0),
  resend_run_count integer not null default 0 check (resend_run_count >= 0),
  dry_run_provider_run_count integer not null default 0 check (dry_run_provider_run_count >= 0),

  reclaimed_count integer not null default 0 check (reclaimed_count >= 0),
  scanned_count integer not null default 0 check (scanned_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  dry_run_count integer not null default 0 check (dry_run_count >= 0),

  live_sent_count integer not null default 0 check (live_sent_count >= 0),
  live_failed_count integer not null default 0 check (live_failed_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.notification_metrics_hourly is
  'Hourly notification worker telemetry buckets. No PII. Admin SELECT only (5H-b).';
create index if not exists idx_notification_metrics_hourly_bucket_desc
  on public.notification_metrics_hourly (bucket_start desc);
alter table public.notification_metrics_hourly enable row level security;
drop policy if exists notification_metrics_hourly_select_admin on public.notification_metrics_hourly;
create policy notification_metrics_hourly_select_admin on public.notification_metrics_hourly
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.notification_metrics_hourly to authenticated, service_role;
grant insert, update on public.notification_metrics_hourly to service_role;
