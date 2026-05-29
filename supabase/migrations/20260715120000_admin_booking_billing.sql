-- Admin-assisted booking billing: unpaid Zoho invoices, Paystack payment links,
-- manual (offline) payment recording, and duplicate-booking protection.
--
-- The admin booking flow reuses the same Paystack + Zoho Books integration as the
-- customer /book checkout, but the admin creates the booking first, an unpaid
-- invoice + payment link are generated, and the customer pays later (online via
-- Paystack or offline recorded by an admin). These columns denormalize the
-- billing state onto the booking so the admin grid can render it directly and so
-- repeated webhook/sync events stay idempotent.

alter table public.bookings
  -- Stable, human-readable reference used across Zoho, Paystack metadata and
  -- customer communication. Backfilled + auto-set by trigger below.
  add column if not exists booking_reference text,
  -- Idempotency key for admin booking creation (prevents duplicate rows on
  -- double-submit). Customer checkout continues to use checkout_session_id.
  add column if not exists idempotency_key text,
  -- Invoice lifecycle independent of the Zoho transport status (zoho_sync_status).
  --   pending  - no invoice yet
  --   created  - unpaid invoice exists in Zoho
  --   paid     - payment recorded against the invoice in Zoho
  --   voided   - invoice voided by an admin
  add column if not exists invoice_status text not null default 'pending',
  -- Paystack payment-link state for this booking.
  add column if not exists paystack_reference text,
  add column if not exists paystack_authorization_url text,
  add column if not exists paystack_transaction_id text,
  -- Payment settlement details (covers both Paystack and manual/offline payments).
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  -- Money tracking, structured to support partial payments in the future even
  -- though only full payments are wired today. All amounts are in cents (ZAR).
  add column if not exists amount_due_cents integer,
  add column if not exists amount_paid_cents integer not null default 0,
  add column if not exists balance_remaining_cents integer;

-- Constrain invoice_status to the canonical set (added separately so the
-- migration stays idempotent across partially-applied environments).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_invoice_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_invoice_status_check
      check (invoice_status in ('pending', 'created', 'paid', 'voided'));
  end if;
end
$$;

-- Backfill booking_reference for existing rows (SHL-XXXXXXXX from the booking id),
-- mirroring the runtime reference format used by the Zoho + notification layers.
update public.bookings
  set booking_reference = 'SHL-' || upper(substr(id::text, 1, 8))
  where booking_reference is null;

-- Auto-populate booking_reference on insert/update when missing so both the
-- customer and admin flows always have a stable reference without a round-trip.
create or replace function public.set_booking_reference()
returns trigger
language plpgsql
as $$
begin
  if new.booking_reference is null or btrim(new.booking_reference) = '' then
    new.booking_reference := 'SHL-' || upper(substr(new.id::text, 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_booking_reference on public.bookings;
create trigger trg_set_booking_reference
  before insert or update on public.bookings
  for each row
  execute function public.set_booking_reference();

-- Duplicate protection for admin booking creation. A single admin submit may
-- create multiple occurrence rows (recurring), so uniqueness is scoped to
-- (idempotency_key, occurrence_index): a double-submit replays the exact same
-- (key, occurrence) tuple and is rejected, while legitimate recurring
-- occurrences (distinct occurrence_index) are allowed.
create unique index if not exists uq_bookings_idempotency_occurrence
  on public.bookings (idempotency_key, occurrence_index)
  where idempotency_key is not null;

create index if not exists idx_bookings_paystack_reference
  on public.bookings (paystack_reference)
  where paystack_reference is not null;

create index if not exists idx_bookings_invoice_status
  on public.bookings (invoice_status);

comment on column public.bookings.booking_reference is
  'Stable human-readable reference (SHL-XXXXXXXX) shared across Zoho, Paystack metadata and customer comms.';
comment on column public.bookings.idempotency_key is
  'Idempotency key for admin booking creation; prevents duplicate rows on double-submit.';
comment on column public.bookings.invoice_status is
  'Invoice lifecycle: pending | created (unpaid invoice exists) | paid | voided.';
comment on column public.bookings.paystack_reference is
  'Paystack transaction reference for this booking''s payment link.';
comment on column public.bookings.paystack_authorization_url is
  'Paystack hosted payment-link URL sent to the customer.';
comment on column public.bookings.paystack_transaction_id is
  'Paystack transaction id captured at verification/webhook time.';
comment on column public.bookings.paid_at is
  'Timestamp the booking was settled (Paystack confirmation or manual recording).';
comment on column public.bookings.payment_method is
  'Settlement method: paystack | eft | cash | card | corporate | other.';
comment on column public.bookings.amount_due_cents is
  'Total amount owed for this booking in cents (ZAR).';
comment on column public.bookings.amount_paid_cents is
  'Total amount paid for this booking in cents (ZAR). Supports future partial payments.';
comment on column public.bookings.balance_remaining_cents is
  'Outstanding balance in cents (ZAR) = amount_due_cents - amount_paid_cents.';

-- ---------------------------------------------------------------------------
-- Duplicate booking detection (admin-only, read-only).
-- Surfaces bookings that share the same booking_reference, or that look like an
-- accidental duplicate of the same booking (same customer/date/time/address/total
-- created within a few minutes). This is intentionally a *view* (no destructive
-- action) so admins can investigate before any manual cleanup.
-- ---------------------------------------------------------------------------
create or replace view public.admin_duplicate_booking_candidates as
  with reference_dupes as (
    select booking_reference
    from public.bookings
    where booking_reference is not null
    group by booking_reference
    having count(*) > 1
  ),
  content_groups as (
    select
      customer_id,
      booking_date,
      booking_time,
      address,
      suburb,
      final_total_cents,
      count(*) as duplicate_count,
      array_agg(id order by created_at) as booking_ids,
      min(created_at) as first_created_at,
      max(created_at) as last_created_at
    from public.bookings
    group by customer_id, booking_date, booking_time, address, suburb, final_total_cents
    having count(*) > 1
  )
  select
    b.id,
    b.booking_reference,
    b.customer_id,
    b.booking_date,
    b.booking_time,
    b.address,
    b.suburb,
    b.final_total_cents,
    b.payment_status,
    b.created_at,
    (b.booking_reference in (select booking_reference from reference_dupes)) as shares_reference,
    exists (
      select 1 from content_groups cg
      where cg.customer_id is not distinct from b.customer_id
        and cg.booking_date = b.booking_date
        and cg.booking_time = b.booking_time
        and cg.address = b.address
        and cg.suburb = b.suburb
        and cg.final_total_cents = b.final_total_cents
    ) as shares_content
  from public.bookings b
  where b.booking_reference in (select booking_reference from reference_dupes)
     or exists (
       select 1 from content_groups cg
       where cg.customer_id is not distinct from b.customer_id
         and cg.booking_date = b.booking_date
         and cg.booking_time = b.booking_time
         and cg.address = b.address
         and cg.suburb = b.suburb
         and cg.final_total_cents = b.final_total_cents
     )
  order by b.booking_date desc, b.created_at desc;

comment on view public.admin_duplicate_booking_candidates is
  'Read-only diagnostic: bookings that share a reference or look like accidental duplicates. Investigate before any manual cleanup; this view never deletes data.';

-- ---------------------------------------------------------------------------
-- Admin manual payment records (EFT, cash, card machine, corporate, other, and
-- Paystack overrides). Doubles as the audit log ("recorded by <admin> on <date>")
-- and provides idempotency so the same manual payment can't be recorded twice.
-- Service-role writes only (RLS enabled, no authenticated policies).
-- ---------------------------------------------------------------------------
create table if not exists public.admin_booking_payment_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  admin_profile_id uuid references public.profiles (id) on delete set null,
  admin_name text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  payment_method text not null
    check (payment_method in ('paystack', 'eft', 'cash', 'card', 'corporate', 'other')),
  payment_date date not null,
  reference text,
  notes text,
  idempotency_key text not null,
  zoho_payment_recorded boolean not null default false,
  created_at timestamptz not null default now(),
  constraint admin_booking_payment_records_idem_unique unique (idempotency_key)
);

create index if not exists idx_admin_booking_payment_records_booking
  on public.admin_booking_payment_records (booking_id, created_at desc);

alter table public.admin_booking_payment_records enable row level security;

comment on table public.admin_booking_payment_records is
  'Admin-recorded manual/offline payments + audit log. Service-role writes only; idempotency_key prevents duplicate recordings.';
