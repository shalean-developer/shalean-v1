-- Phase 2: deferred assignment operational readiness (cron run log + admin audit action + hourly pg_cron).

-- Admin audit: allow deferred_dispatch_now action.
alter table public.admin_operational_audit
  drop constraint if exists admin_operational_audit_action_check;
alter table public.admin_operational_audit
  add constraint admin_operational_audit_action_check
  check (action in (
    'assignment_recovery',
    'manual_dispatch_offer',
    'replace_open_offer',
    'notification_requeue',
    'deferred_dispatch_now'
  ));
-- Append-only log of deferred dispatch cron executions (no PII).
create table if not exists public.deferred_dispatch_cron_runs (
  id uuid primary key default gen_random_uuid(),

  started_at timestamptz not null,
  completed_at timestamptz not null default now(),

  ok boolean not null,

  trigger_source text not null default 'cron'
    check (trigger_source in ('cron', 'manual')),

  candidate_count integer not null default 0 check (candidate_count >= 0),
  attempted_count integer not null default 0 check (attempted_count >= 0),
  dispatched_count integer not null default 0 check (dispatched_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),

  failed jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);
comment on table public.deferred_dispatch_cron_runs is
  'Append-only log of /api/cron/dispatch-deferred-assignments runs. Admin SELECT only.';
create index if not exists idx_deferred_dispatch_cron_runs_completed_at
  on public.deferred_dispatch_cron_runs (completed_at desc);
drop trigger if exists deferred_dispatch_cron_runs_append_only on public.deferred_dispatch_cron_runs;
create trigger deferred_dispatch_cron_runs_append_only
  before update or delete on public.deferred_dispatch_cron_runs
  for each row
  execute function public.forbid_admin_operational_audit_mutation();
alter table public.deferred_dispatch_cron_runs enable row level security;
drop policy if exists deferred_dispatch_cron_runs_select_admin on public.deferred_dispatch_cron_runs;
create policy deferred_dispatch_cron_runs_select_admin on public.deferred_dispatch_cron_runs
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.deferred_dispatch_cron_runs to authenticated, service_role;
grant insert on public.deferred_dispatch_cron_runs to service_role;
-- pg_cron: hourly HTTP call to dispatch deferred assignments (Vault secrets required post-deploy).
create or replace function public.invoke_dispatch_deferred_assignments_http()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, net, pg_catalog
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
  into v_url
  from vault.decrypted_secrets
  where name = 'dispatch_deferred_assignments_cron_url'
  limit 1;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning
      'dispatch_deferred_assignments cron skipped: create vault secrets dispatch_deferred_assignments_cron_url and cron_secret (see docs/operations/dispatch-deferred-assignments-cron.md)';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  into v_request_id;

  return v_request_id;
end;
$$;
comment on function public.invoke_dispatch_deferred_assignments_http() is
  'pg_net POST to /api/cron/dispatch-deferred-assignments. Requires Vault dispatch_deferred_assignments_cron_url and cron_secret.';
revoke all on function public.invoke_dispatch_deferred_assignments_http() from public;
revoke all on function public.invoke_dispatch_deferred_assignments_http() from anon;
revoke all on function public.invoke_dispatch_deferred_assignments_http() from authenticated;
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'dispatch-deferred-assignments-hourly';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;
select cron.schedule(
  'dispatch-deferred-assignments-hourly',
  '0 * * * *',
  $$select public.invoke_dispatch_deferred_assignments_http();$$
);
