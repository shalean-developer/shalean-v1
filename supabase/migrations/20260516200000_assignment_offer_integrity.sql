-- Phase 8: assignment offer integrity for dispatch engine.

create unique index if not exists idx_assignment_offers_one_open_per_cleaner
  on public.assignment_offers (booking_id, cleaner_id)
  where status = 'offered';
create index if not exists idx_assignment_offers_offered_expires
  on public.assignment_offers (expires_at)
  where status = 'offered';
