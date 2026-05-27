-- Phase 7: booking payment lock before Paystack initialize.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'booking_lock_status'
  ) then
    create type public.booking_lock_status as enum ('active', 'consumed', 'expired');
  end if;
end $$;
create table if not exists public.booking_locks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  idempotency_key text not null,
  status public.booking_lock_status not null default 'active',
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  locked_price_cents bigint not null check (locked_price_cents > 0),
  locked_currency text not null default 'ZAR',
  locked_service_slug text not null,
  locked_schedule_start timestamptz not null,
  locked_schedule_end timestamptz not null,
  locked_schedule_timezone text not null default 'Africa/Johannesburg',
  locked_area_slug text not null,
  locked_cleaner_preference jsonb not null default '{}'::jsonb,
  locked_metadata jsonb not null default '{}'::jsonb,
  client_quote_total_cents bigint,
  inputs_hash text not null,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_locks_idempotency_key_unique unique (idempotency_key),
  constraint booking_locks_booking_id_unique unique (booking_id)
);
comment on table public.booking_locks is
  'Checkout lock: freezes quote, schedule, location, and cleaner preference before Paystack initialize.';
create index if not exists idx_booking_locks_customer_status
  on public.booking_locks (customer_id, status);
create index if not exists idx_booking_locks_expires_at
  on public.booking_locks (expires_at)
  where status = 'active';
alter table public.payments
  add column if not exists payment_link_expires_at timestamptz;
comment on column public.payments.payment_link_expires_at is
  'Paystack checkout link expiry aligned with booking_locks.expires_at.';
alter table public.booking_locks enable row level security;
drop policy if exists booking_locks_select_customer on public.booking_locks;
create policy booking_locks_select_customer on public.booking_locks
  for select to authenticated
  using (customer_id = public.auth_customer_id() or public.auth_is_admin());
drop policy if exists booking_locks_admin_write on public.booking_locks;
create policy booking_locks_admin_write on public.booking_locks
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
grant select on public.booking_locks to authenticated, service_role;
grant all on public.booking_locks to service_role;
