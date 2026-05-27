-- Stage 5G-a: Durable notification worker run log (append-only, admin-read, service-role insert).

create table if not exists public.notification_worker_runs (
  id uuid primary key default gen_random_uuid(),

  started_at timestamptz null,
  completed_at timestamptz not null default now(),

  ok boolean not null,

  delivery_enabled boolean not null,
  email_provider text null
    check (email_provider is null or email_provider in ('dry_run', 'resend')),

  trigger_source text not null default 'cron'
    check (trigger_source in ('cron', 'manual')),

  reclaimed integer not null default 0 check (reclaimed >= 0),
  scanned integer not null default 0 check (scanned >= 0),
  sent integer not null default 0 check (sent >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  failed integer not null default 0 check (failed >= 0),
  dry_run integer not null default 0 check (dry_run >= 0),

  error_count integer not null default 0 check (error_count >= 0),
  errors jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);
comment on table public.notification_worker_runs is
  'Append-only log of notification outbox cron executions. No PII; admin SELECT only (5G-a).';
create index if not exists idx_notification_worker_runs_completed_at
  on public.notification_worker_runs (completed_at desc);
create index if not exists idx_notification_worker_runs_ok_completed_at
  on public.notification_worker_runs (ok, completed_at desc);
create index if not exists idx_notification_worker_runs_trigger_completed_at
  on public.notification_worker_runs (trigger_source, completed_at desc);
drop trigger if exists notification_worker_runs_append_only on public.notification_worker_runs;
create trigger notification_worker_runs_append_only
  before update or delete on public.notification_worker_runs
  for each row
  execute function public.forbid_admin_operational_audit_mutation();
alter table public.notification_worker_runs enable row level security;
drop policy if exists notification_worker_runs_select_admin on public.notification_worker_runs;
create policy notification_worker_runs_select_admin on public.notification_worker_runs
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.notification_worker_runs to authenticated, service_role;
grant insert on public.notification_worker_runs to service_role;
