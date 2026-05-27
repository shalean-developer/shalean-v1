-- Stage 5B-1a: Durable admin operational audit (append-only, admin-read, service-role write).

create table if not exists public.admin_operational_audit (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings (id) on delete cascade,

  admin_profile_id uuid not null
    references public.profiles (id) on delete restrict,

  action text not null,
  outcome text not null,

  reason text null,
  result_code text null,

  cleaner_id uuid null references public.cleaners (id) on delete set null,
  offer_id uuid null references public.assignment_offers (id) on delete set null,
  cancelled_offer_id uuid null references public.assignment_offers (id) on delete set null,

  idempotency_key text null,

  booking_status_before text null,
  booking_status_after text null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint admin_operational_audit_action_check
    check (action in (
      'assignment_recovery',
      'manual_dispatch_offer',
      'replace_open_offer'
    )),

  constraint admin_operational_audit_outcome_check
    check (outcome in ('success', 'idempotent', 'rejected', 'failed'))
);
comment on table public.admin_operational_audit is
  'Append-only log of human admin operational actions. Not a lifecycle audit; admin-only read.';
create unique index if not exists admin_operational_audit_idempotency_unique
  on public.admin_operational_audit (booking_id, idempotency_key)
  where idempotency_key is not null
    and outcome in ('success', 'idempotent');
create index if not exists idx_admin_operational_audit_booking_created
  on public.admin_operational_audit (booking_id, created_at desc);
create index if not exists idx_admin_operational_audit_admin_created
  on public.admin_operational_audit (admin_profile_id, created_at desc);
create index if not exists idx_admin_operational_audit_action_created
  on public.admin_operational_audit (action, created_at desc);
-- Append-only (same pattern as booking_state_audit)
create or replace function public.forbid_admin_operational_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_operational_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
drop trigger if exists admin_operational_audit_append_only on public.admin_operational_audit;
create trigger admin_operational_audit_append_only
  before update or delete on public.admin_operational_audit
  for each row
  execute function public.forbid_admin_operational_audit_mutation();
alter table public.admin_operational_audit enable row level security;
drop policy if exists admin_operational_audit_select_admin on public.admin_operational_audit;
create policy admin_operational_audit_select_admin on public.admin_operational_audit
  for select to authenticated
  using (public.auth_is_admin());
-- No INSERT/UPDATE/DELETE policies for authenticated — writes via service_role only.

grant select on public.admin_operational_audit to authenticated, service_role;
grant insert on public.admin_operational_audit to service_role;
