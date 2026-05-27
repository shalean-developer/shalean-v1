-- Admin-assisted booking: draft creation audit + idempotency (Phase 2).

create table if not exists public.admin_booking_assist_audit (
  id uuid primary key default gen_random_uuid(),

  admin_profile_id uuid not null
    references public.profiles (id) on delete restrict,

  customer_id uuid not null
    references public.customers (id) on delete restrict,

  booking_id uuid null
    references public.bookings (id) on delete set null,

  action text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint admin_booking_assist_audit_action_nonempty
    check (length(trim(action)) > 0),

  constraint admin_booking_assist_audit_idempotency_nonempty
    check (length(trim(idempotency_key)) > 0)
);
comment on table public.admin_booking_assist_audit is
  'Append-only log of admin-assisted booking operations (draft create, rejections). Service-role writes only.';
create index if not exists idx_admin_booking_assist_audit_customer_created
  on public.admin_booking_assist_audit (customer_id, created_at desc);
create index if not exists idx_admin_booking_assist_audit_admin_created
  on public.admin_booking_assist_audit (admin_profile_id, created_at desc);
create index if not exists idx_admin_booking_assist_audit_booking_created
  on public.admin_booking_assist_audit (booking_id, created_at desc)
  where booking_id is not null;
create index if not exists idx_admin_booking_assist_audit_action_created
  on public.admin_booking_assist_audit (action, created_at desc);
create or replace function public.forbid_admin_booking_assist_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_booking_assist_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
drop trigger if exists admin_booking_assist_audit_append_only on public.admin_booking_assist_audit;
create trigger admin_booking_assist_audit_append_only
  before update or delete on public.admin_booking_assist_audit
  for each row
  execute function public.forbid_admin_booking_assist_audit_mutation();
alter table public.admin_booking_assist_audit enable row level security;
drop policy if exists admin_booking_assist_audit_select_admin on public.admin_booking_assist_audit;
create policy admin_booking_assist_audit_select_admin on public.admin_booking_assist_audit
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.admin_booking_assist_audit to authenticated, service_role;
grant insert on public.admin_booking_assist_audit to service_role;
-- Idempotency outcomes for admin draft create (no public policies).

create table if not exists public.admin_booking_assist_idempotency (
  idempotency_key text primary key,

  admin_profile_id uuid not null
    references public.profiles (id) on delete restrict,

  customer_id uuid not null
    references public.customers (id) on delete restrict,

  result jsonb not null,
  created_at timestamptz not null default now()
);
comment on table public.admin_booking_assist_idempotency is
  'Idempotent outcomes for admin-assisted booking draft creation. Service-role only.';
create index if not exists idx_admin_booking_assist_idempotency_customer_created
  on public.admin_booking_assist_idempotency (customer_id, created_at desc);
alter table public.admin_booking_assist_idempotency enable row level security;
-- No policies: authenticated cannot read or write; service_role bypasses RLS.

grant all on public.admin_booking_assist_idempotency to service_role;
