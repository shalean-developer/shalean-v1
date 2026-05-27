-- Stage 5I-α soak: daily HTTP dry-run for notification retention eligibility (no DELETE).
-- Secrets are NOT stored in this migration — create them in Vault after deploy
-- (see docs/operations/notification-retention-cleanup-cron.md).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function public.invoke_notification_retention_dry_run_http()
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
  where name = 'cleanup_notification_retention_cron_url'
  limit 1;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning
      'notification_retention_dry_run cron skipped: create vault secrets cleanup_notification_retention_cron_url and cron_secret (see docs/operations/notification-retention-cleanup-cron.md)';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{"source":"pg_cron"}'::jsonb
  )
  into v_request_id;

  return v_request_id;
end;
$$;
comment on function public.invoke_notification_retention_dry_run_http() is
  'pg_net POST to /api/cron/cleanup-notification-retention (dry-run counts only). Requires Vault secrets cleanup_notification_retention_cron_url and cron_secret.';
revoke all on function public.invoke_notification_retention_dry_run_http() from public;
revoke all on function public.invoke_notification_retention_dry_run_http() from anon;
revoke all on function public.invoke_notification_retention_dry_run_http() from authenticated;
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'notification-retention-dry-run-daily';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;
select cron.schedule(
  'notification-retention-dry-run-daily',
  '15 3 * * *',
  $$select public.invoke_notification_retention_dry_run_http();$$
);
