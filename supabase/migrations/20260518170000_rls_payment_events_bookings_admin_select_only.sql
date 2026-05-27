-- Stage 5B-3 Phase 4a: Remove admin JWT/PostgREST write access on payment_events and bookings.
-- Admin/customer/cleaner SELECT and bookings_update_customer unchanged; writes via service_role + commands/RPCs.
-- Rollback: docs/operations/rls-tightening-rollbacks.md

drop policy if exists payment_events_admin_write on public.payment_events;
drop policy if exists bookings_admin_write on public.bookings;
comment on table public.payment_events is
  'Raw provider webhook / event log. Inserts via service_role (recordPaymentEvent). Admin authenticated: SELECT only (5B-3 Phase 4a).';
comment on table public.bookings is
  'Booking aggregate. Status via booking_* RPCs (service_role); metadata via commands. Admin authenticated: SELECT only (5B-3 Phase 4a).';
