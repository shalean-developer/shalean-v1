-- Phase 1: deferred assignment dispatch window (confirmed bookings stay paid until dispatch opens).

alter table public.bookings
  add column if not exists assignment_dispatch_at timestamptz null;
comment on column public.bookings.assignment_dispatch_at is
  'When post-payment assignment dispatch may begin (scheduled_start minus lead days). Null = immediate dispatch.';
create index if not exists bookings_confirmed_assignment_dispatch_at_idx
  on public.bookings (assignment_dispatch_at)
  where status = 'confirmed'
    and assignment_dispatch_at is not null;
