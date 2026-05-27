alter table public.cleaners
  add column if not exists tenure_months integer not null default 0 check (tenure_months >= 0);

alter table public.bookings
  add column if not exists extra_rooms integer not null default 0 check (extra_rooms >= 0),
  add column if not exists customer_notes text,
  add column if not exists access_notes text,
  add column if not exists estimated_minutes integer;

alter table public.booking_cleaners
  add column if not exists earning_cents integer check (earning_cents is null or earning_cents > 0),
  add column if not exists eligible_value_cents integer check (eligible_value_cents is null or eligible_value_cents >= 0),
  add column if not exists earning_rate_percent integer check (earning_rate_percent is null or earning_rate_percent in (60, 70)),
  add column if not exists earning_rule text,
  add column if not exists offered_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists decline_reason text,
  add column if not exists offer_expires_at timestamptz;

update public.bookings
set estimated_minutes = coalesce(estimated_minutes, (pricing_snapshot->>'estimatedMinutes')::integer)
where estimated_minutes is null
  and pricing_snapshot ? 'estimatedMinutes';

update public.booking_cleaners
set status = 'pending_payment'
where status in ('planned', 'requested')
  and earning_cents is null;

create unique index if not exists booking_cleaners_active_offer_unique_idx
  on public.booking_cleaners(booking_id, cleaner_id)
  where cleaner_id is not null
    and status in ('pending_payment', 'offered', 'accepted');

create index if not exists booking_cleaners_status_idx
  on public.booking_cleaners(status);

create index if not exists booking_cleaners_cleaner_status_idx
  on public.booking_cleaners(cleaner_id, status);;
