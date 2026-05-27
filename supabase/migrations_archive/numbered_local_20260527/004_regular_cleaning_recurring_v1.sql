create table if not exists public.booking_recurring_series (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null default 'regular-cleaning',
  customer_id uuid references public.customers(id),
  frequency text not null check (frequency in ('weekly', 'fortnightly', 'monthly')),
  selected_weekdays integer[] not null default array[]::integer[],
  start_date date not null,
  time_window text not null,
  occurrence_count integer not null check (occurrence_count > 0),
  per_occurrence_total_cents integer not null check (per_occurrence_total_cents >= 0),
  series_total_cents integer not null check (series_total_cents >= 0),
  payment_status public.v1_payment_status not null default 'pending',
  status text not null default 'payment_pending',
  recurrence_config jsonb not null default '{}'::jsonb,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists recurring_series_id uuid references public.booking_recurring_series(id),
  add column if not exists occurrence_index integer,
  add column if not exists occurrence_count integer,
  add column if not exists occurrence_date date,
  add column if not exists recurrence_frequency text,
  add column if not exists recurrence_weekdays integer[] not null default array[]::integer[],
  add column if not exists per_occurrence_total_cents integer,
  add column if not exists series_total_cents integer;

create index if not exists bookings_recurring_series_idx
  on public.bookings(recurring_series_id);

create index if not exists booking_recurring_series_status_idx
  on public.booking_recurring_series(status, payment_status);

alter table public.booking_recurring_series enable row level security;

grant all privileges on table public.booking_recurring_series to service_role;
grant select on table public.booking_recurring_series to anon, authenticated, service_role;
