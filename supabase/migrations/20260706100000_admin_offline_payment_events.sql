-- Admin-assisted offline payment events (EFT / cash / card machine). Service-role writes only.

create table if not exists public.admin_offline_payment_events (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings (id) on delete restrict,

  customer_id uuid not null
    references public.customers (id) on delete restrict,

  admin_profile_id uuid not null
    references public.profiles (id) on delete restrict,

  rail text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  evidence_reference text not null,
  provider_reference text not null,
  idempotency_key text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint admin_offline_payment_events_rail_valid
    check (rail in ('eft', 'cash', 'card_machine')),

  constraint admin_offline_payment_events_status_valid
    check (status in ('pending', 'finalized', 'failed')),

  constraint admin_offline_payment_events_idempotency_key_unique
    unique (idempotency_key),

  constraint admin_offline_payment_events_evidence_nonempty
    check (length(trim(evidence_reference)) > 0),

  constraint admin_offline_payment_events_provider_ref_nonempty
    check (length(trim(provider_reference)) > 0)
);
comment on table public.admin_offline_payment_events is
  'Admin-recorded offline payments before canonical finalizePaidBooking. Service-role insert only.';
create unique index if not exists idx_admin_offline_payment_events_booking_finalized
  on public.admin_offline_payment_events (booking_id)
  where status = 'finalized';
create index if not exists idx_admin_offline_payment_events_booking_created
  on public.admin_offline_payment_events (booking_id, created_at desc);
alter table public.admin_offline_payment_events enable row level security;
