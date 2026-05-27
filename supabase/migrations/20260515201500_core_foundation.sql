-- Core foundation schema: profiles, customers, cleaners, services, bookings,
-- payments, assignment offers, earnings, notifications, and booking audit.
-- RLS is intentionally deferred — add policies before any client-facing exposure.

-- ---------------------------------------------------------------------------
-- Enum types (Postgres enums mirror application constants)
-- Idempotent: safe when a previous push partially created types on remote.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    create type public.user_role as enum ('customer', 'cleaner', 'admin');
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'booking_status'
  ) then
    create type public.booking_status as enum (
      'draft',
      'pending_payment',
      'confirmed',
      'pending_assignment',
      'assigned',
      'in_progress',
      'completed',
      'cancelled',
      'payment_failed'
    );
  end if;
end $$;
comment on type public.booking_status is
  'Canonical booking lifecycle states. Values must stay aligned with TypeScript BookingStatus in src/features/bookings/server/types.ts.';
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_status'
  ) then
    create type public.payment_status as enum (
      'initialized',
      'pending',
      'paid',
      'failed',
      'refunded'
    );
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'assignment_offer_status'
  ) then
    create type public.assignment_offer_status as enum (
      'offered',
      'accepted',
      'declined',
      'expired',
      'cancelled'
    );
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_outbox_status'
  ) then
    create type public.notification_outbox_status as enum (
      'pending',
      'processing',
      'sent',
      'failed'
    );
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- Tables (IF NOT EXISTS: safe when a previous push partially created schema)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is
  'RLS: not enabled in this foundation migration — configure policies in a later phase before production.';
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  company_name text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.customers is
  'RLS: deferred — see profiles.';
create table if not exists public.cleaners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.cleaners is
  'RLS: deferred — see profiles.';
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_duration_minutes integer not null default 60,
  base_price_cents bigint not null check (base_price_cents >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.services is
  'Catalog of bookable services. RLS: deferred.';
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  cleaner_id uuid references public.cleaners (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  status public.booking_status not null default 'draft',
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'USD',
  series_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_scheduled_range check (scheduled_end > scheduled_start)
);
comment on table public.bookings is
  'Bookings row. All booking status changes must go through executeBookingCommand (see src/features/bookings/server/commands/) plus audit/RPC persistence — do not update status ad hoc from app code or SQL.';
comment on column public.bookings.status is
  'Must only change via lifecycle commands that validate transitions, write booking_state_audit rows, and enforce invariants.';
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  status public.payment_status not null default 'initialized',
  provider text not null default 'paystack',
  provider_ref text,
  idempotency_key text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_idempotency_key_unique unique (idempotency_key)
);
comment on table public.payments is
  'RLS: deferred. idempotency_key is unique for safe payment initialization retries.';
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments (id) on delete cascade,
  provider_event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  constraint payment_events_provider_event_id_unique unique (provider_event_id)
);
comment on table public.payment_events is
  'Raw provider webhook / event log. provider_event_id is unique for deduplication.';
create table if not exists public.assignment_offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  status public.assignment_offer_status not null default 'offered',
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.assignment_offers is
  'Per-cleaner offers before a booking is assigned. RLS: deferred.';
create table if not exists public.earning_lines (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  amount_cents bigint not null,
  line_type text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.earning_lines is
  'Append-only style earnings ledger lines (no UPDATE/DELETE trigger yet — enforce in application layer until payouts phase).';
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_outbox_status not null default 'pending',
  attempts integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.notification_outbox is
  'Reliable outbound notifications with retries. RLS: deferred.';
create table if not exists public.booking_state_audit (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  command text not null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.booking_state_audit is
  'Append-only audit of booking status transitions. All booking status changes must go through lifecycle commands that insert a matching audit row. UPDATE and DELETE are blocked by trigger.';
comment on column public.booking_state_audit.command is
  'Domain command name (e.g. CreateBooking, ConfirmPayment) aligned with BookingCommandName in TypeScript.';
-- ---------------------------------------------------------------------------
-- Append-only enforcement: booking_state_audit
-- ---------------------------------------------------------------------------

create or replace function public.forbid_booking_state_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'booking_state_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'booking_state_audit'
  ) then
    drop trigger if exists booking_state_audit_append_only on public.booking_state_audit;
    create trigger booking_state_audit_append_only
      before update or delete on public.booking_state_audit
      for each row
      execute function public.forbid_booking_state_audit_mutation();
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_bookings_status_scheduled_start
  on public.bookings (status, scheduled_start);
create index if not exists idx_bookings_customer_created_at
  on public.bookings (customer_id, created_at desc);
create index if not exists idx_bookings_cleaner_scheduled_start
  on public.bookings (cleaner_id, scheduled_start)
  where cleaner_id is not null;
create index if not exists idx_payments_booking_id on public.payments (booking_id);
create index if not exists idx_payments_provider_ref on public.payments (provider_ref)
  where provider_ref is not null;
-- payment_events(provider_event_id): unique constraint supplies an index.

create index if not exists idx_assignment_offers_booking_cleaner
  on public.assignment_offers (booking_id, cleaner_id);
create index if not exists idx_earning_lines_cleaner_created_at
  on public.earning_lines (cleaner_id, created_at desc);
create index if not exists idx_notification_outbox_status_next_retry
  on public.notification_outbox (status, next_retry_at);
