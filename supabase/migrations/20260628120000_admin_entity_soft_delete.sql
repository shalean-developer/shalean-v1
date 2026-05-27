-- Admin soft-delete columns and cross-entity delete/archive audit log.

alter table public.bookings
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists delete_reason text;
comment on column public.bookings.deleted_at is
  'Soft-delete / archive marker. Row and financial history are preserved.';
comment on column public.bookings.deleted_by_profile_id is
  'Admin profile that archived or soft-deleted the booking.';
comment on column public.bookings.delete_reason is
  'Admin-documented reason for archive or soft-delete.';
alter table public.customers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists delete_reason text;
comment on column public.customers.deleted_at is
  'Soft-delete / archive marker. Booking and payment history remain.';
comment on column public.customers.deleted_by_profile_id is
  'Admin profile that archived the customer.';
comment on column public.customers.delete_reason is
  'Admin-documented reason for customer archive.';
create index if not exists idx_bookings_not_deleted
  on public.bookings (id)
  where deleted_at is null;
create index if not exists idx_customers_not_deleted
  on public.customers (id)
  where deleted_at is null;
create table if not exists public.admin_delete_audit (
  id uuid primary key default gen_random_uuid(),

  entity_type text not null,
  entity_id uuid not null,

  admin_profile_id uuid
    references public.profiles (id) on delete set null,

  action text not null,
  reason text,
  blocked_reason text,
  outcome text not null,

  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,

  created_at timestamptz not null default now(),

  constraint admin_delete_audit_entity_type_nonempty
    check (length(trim(entity_type)) > 0),

  constraint admin_delete_audit_action_nonempty
    check (length(trim(action)) > 0),

  constraint admin_delete_audit_outcome_nonempty
    check (length(trim(outcome)) > 0)
);
comment on table public.admin_delete_audit is
  'Append-only log of admin delete/archive attempts on bookings, customers, and cleaners.';
create unique index if not exists admin_delete_audit_idempotency_unique
  on public.admin_delete_audit (idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_admin_delete_audit_entity_created
  on public.admin_delete_audit (entity_type, entity_id, created_at desc);
create index if not exists idx_admin_delete_audit_admin_created
  on public.admin_delete_audit (admin_profile_id, created_at desc)
  where admin_profile_id is not null;
create or replace function public.forbid_admin_delete_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_delete_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
drop trigger if exists admin_delete_audit_append_only on public.admin_delete_audit;
create trigger admin_delete_audit_append_only
  before update or delete on public.admin_delete_audit
  for each row
  execute function public.forbid_admin_delete_audit_mutation();
alter table public.admin_delete_audit enable row level security;
drop policy if exists admin_delete_audit_select_admin on public.admin_delete_audit;
create policy admin_delete_audit_select_admin on public.admin_delete_audit
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.admin_delete_audit to authenticated, service_role;
grant insert on public.admin_delete_audit to service_role;
