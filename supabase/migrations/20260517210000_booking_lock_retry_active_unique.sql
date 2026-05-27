-- Stage 2B-2c-1: allow multiple historical booking locks per booking (retry payment foundation).
-- Replaces one-lock-per-booking-forever with at most one *active* lock per booking.

alter table public.booking_locks
  drop constraint if exists booking_locks_booking_id_unique;
-- Active checkout lock: status enum value 'active' (see booking_lock_status).
-- assertActiveBookingLock() requires status = 'active' before initialize; consumed/expired rows are historical.
create unique index if not exists booking_locks_one_active_per_booking_idx
  on public.booking_locks (booking_id)
  where (status = 'active'::public.booking_lock_status);
comment on index public.booking_locks_one_active_per_booking_idx is
  'At most one active checkout lock per booking; consumed/expired locks may repeat for payment retry (Stage 2B-2c).';
