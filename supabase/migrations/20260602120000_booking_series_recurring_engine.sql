-- Recurring booking series (Stage 2): materialized cadence after first paid visit.

create table if not exists public.booking_series (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  user_id uuid references public.profiles (id) on delete set null,
  created_from_booking_id uuid not null references public.bookings (id) on delete restrict,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  timezone text not null default 'Africa/Johannesburg',
  anchor_scheduled_start timestamptz not null,
  next_occurrence_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  template_metadata jsonb not null default '{}'::jsonb,
  service_slug text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_series_created_from_booking_unique unique (created_from_booking_id)
);
comment on table public.booking_series is
  'Materialized recurring cadence after first paid booking. Child visits link via bookings.series_id.';
create index if not exists booking_series_customer_id_idx
  on public.booking_series (customer_id);
create index if not exists booking_series_status_next_occurrence_idx
  on public.booking_series (status, next_occurrence_at)
  where status = 'active';
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_series_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_series_id_fkey
      foreign key (series_id) references public.booking_series (id) on delete set null;
  end if;
end $$;
create unique index if not exists idx_bookings_series_scheduled_start_unique
  on public.bookings (series_id, scheduled_start)
  where series_id is not null;
