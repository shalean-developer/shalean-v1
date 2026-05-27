-- Lightweight cron run tracking for Zoho invoice payment jobs.

create table if not exists public.zoho_invoice_payment_cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  constraint zoho_invoice_payment_cron_runs_status_check
    check (status in ('started', 'completed', 'failed'))
);
create index if not exists idx_zoho_invoice_payment_cron_runs_job_name
  on public.zoho_invoice_payment_cron_runs (job_name);
create index if not exists idx_zoho_invoice_payment_cron_runs_started_at
  on public.zoho_invoice_payment_cron_runs (started_at desc);
alter table public.zoho_invoice_payment_cron_runs enable row level security;
comment on table public.zoho_invoice_payment_cron_runs is
  'Safe cron run summaries for Zoho invoice payment jobs. RLS enabled with no public policies; service_role only.';
