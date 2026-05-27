-- Supabase Cron: hourly HTTP call to expire stale assignment offers.
-- Secrets are NOT stored in this migration — create them in Vault after deploy (see docs/operations/expire-assignment-offers-cron.md).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
-- Invokes the Next.js cron route using secrets from Supabase Vault.
create or replace function public.invoke_expire_assignment_offers_http()
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
  where name = 'expire_offers_cron_url'
  limit 1;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning
      'expire_assignment_offers cron skipped: create vault secrets expire_offers_cron_url and cron_secret (see docs/operations/expire-assignment-offers-cron.md)';
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
comment on function public.invoke_expire_assignment_offers_http() is
  'pg_net POST to /api/cron/expire-assignment-offers. Requires Vault secrets expire_offers_cron_url (full URL) and cron_secret (same value as Vercel CRON_SECRET).';
revoke all on function public.invoke_expire_assignment_offers_http() from public;
revoke all on function public.invoke_expire_assignment_offers_http() from anon;
revoke all on function public.invoke_expire_assignment_offers_http() from authenticated;
-- Idempotent reschedule: drop existing job with same name, then register hourly.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'expire-assignment-offers-hourly';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;
select cron.schedule(
  'expire-assignment-offers-hourly',
  '0 * * * *',
  $$select public.invoke_expire_assignment_offers_http();$$
);
