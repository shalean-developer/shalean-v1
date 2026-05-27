-- Phase 3B: Append-only audit log for admin customer profile operations.

create table if not exists public.customer_operational_audit (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null
    references public.customers (id) on delete restrict,

  admin_profile_id uuid
    references public.profiles (id) on delete set null,

  action text not null,
  outcome text not null,
  reason text,

  metadata jsonb not null default '{}'::jsonb,

  idempotency_key text,

  created_at timestamptz not null default now(),

  constraint customer_operational_audit_action_nonempty
    check (length(trim(action)) > 0),

  constraint customer_operational_audit_outcome_nonempty
    check (length(trim(outcome)) > 0)
);
comment on table public.customer_operational_audit is
  'Append-only log of admin customer profile operations (create, later edit).';
create unique index if not exists customer_operational_audit_idempotency_unique
  on public.customer_operational_audit (idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_customer_operational_audit_customer_created
  on public.customer_operational_audit (customer_id, created_at desc);
create index if not exists idx_customer_operational_audit_admin_created
  on public.customer_operational_audit (admin_profile_id, created_at desc)
  where admin_profile_id is not null;
create index if not exists idx_customer_operational_audit_action_created
  on public.customer_operational_audit (action, created_at desc);
create or replace function public.forbid_customer_operational_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'customer_operational_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
drop trigger if exists customer_operational_audit_append_only on public.customer_operational_audit;
create trigger customer_operational_audit_append_only
  before update or delete on public.customer_operational_audit
  for each row
  execute function public.forbid_customer_operational_audit_mutation();
alter table public.customer_operational_audit enable row level security;
drop policy if exists customer_operational_audit_select_admin on public.customer_operational_audit;
create policy customer_operational_audit_select_admin on public.customer_operational_audit
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.customer_operational_audit to authenticated, service_role;
grant insert on public.customer_operational_audit to service_role;
