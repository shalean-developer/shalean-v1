-- Phase 4: append-only log of recurring occurrence generation cron runs.

create table if not exists public.recurring_generation_runs (
  id uuid primary key default gen_random_uuid(),

  run_id text not null,

  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  duration_ms integer not null default 0 check (duration_ms >= 0),

  status text not null check (status in ('success', 'partial', 'failed')),

  active_series_scanned integer not null default 0 check (active_series_scanned >= 0),
  children_generated integer not null default 0 check (children_generated >= 0),
  duplicates_skipped integer not null default 0 check (duplicates_skipped >= 0),
  skipped_paused integer not null default 0 check (skipped_paused >= 0),
  skipped_cancelled integer not null default 0 check (skipped_cancelled >= 0),
  failures_count integer not null default 0 check (failures_count >= 0),

  error_summary jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);
comment on table public.recurring_generation_runs is
  'Append-only log of /api/cron/generate-recurring-occurrences runs. Admin SELECT only.';
create index if not exists idx_recurring_generation_runs_completed_at
  on public.recurring_generation_runs (completed_at desc);
drop trigger if exists recurring_generation_runs_append_only on public.recurring_generation_runs;
create trigger recurring_generation_runs_append_only
  before update or delete on public.recurring_generation_runs
  for each row
  execute function public.forbid_admin_operational_audit_mutation();
alter table public.recurring_generation_runs enable row level security;
drop policy if exists recurring_generation_runs_select_admin on public.recurring_generation_runs;
create policy recurring_generation_runs_select_admin on public.recurring_generation_runs
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.recurring_generation_runs to authenticated, service_role;
grant insert on public.recurring_generation_runs to service_role;
