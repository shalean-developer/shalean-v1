-- Phase 6A: Multi-day recurring schedules (one group, one booking_series per weekday).

create table if not exists public.recurring_schedule_groups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  service_slug text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  frequency text not null check (frequency in ('weekly', 'biweekly')),
  timezone text not null default 'Africa/Johannesburg',
  label text,
  selected_days smallint[] not null,
  anchor_booking_id uuid not null references public.bookings (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_schedule_groups_anchor_booking_unique unique (anchor_booking_id),
  constraint recurring_schedule_groups_selected_days_nonempty check (
    cardinality(selected_days) >= 1
  )
);
comment on table public.recurring_schedule_groups is
  'Customer-facing multi-day recurring package. Each selected weekday has its own booking_series row.';
create index if not exists recurring_schedule_groups_customer_id_idx
  on public.recurring_schedule_groups (customer_id);
create index if not exists recurring_schedule_groups_status_idx
  on public.recurring_schedule_groups (status);
alter table public.booking_series
  add column if not exists group_id uuid references public.recurring_schedule_groups (id) on delete set null,
  add column if not exists weekday smallint,
  add column if not exists slot_label text;
create index if not exists booking_series_group_id_idx
  on public.booking_series (group_id)
  where group_id is not null;
alter table public.bookings
  add column if not exists synthetic_anchor boolean not null default false;
comment on column public.bookings.synthetic_anchor is
  'Cadence-only anchor for a booking_series weekday slot. Never dispatch, payout, or customer visit history.';
create index if not exists bookings_synthetic_anchor_idx
  on public.bookings (synthetic_anchor)
  where synthetic_anchor = true;
alter table public.recurring_schedule_groups enable row level security;
drop policy if exists recurring_schedule_groups_select_admin on public.recurring_schedule_groups;
create policy recurring_schedule_groups_select_admin on public.recurring_schedule_groups
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists recurring_schedule_groups_select_customer on public.recurring_schedule_groups;
create policy recurring_schedule_groups_select_customer on public.recurring_schedule_groups
  for select to authenticated
  using (customer_id = public.auth_customer_id());
drop policy if exists recurring_schedule_groups_admin_write on public.recurring_schedule_groups;
create policy recurring_schedule_groups_admin_write on public.recurring_schedule_groups
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
grant select on public.recurring_schedule_groups to authenticated, service_role;
grant insert, update on public.recurring_schedule_groups to service_role;
