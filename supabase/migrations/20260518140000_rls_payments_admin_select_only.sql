-- Stage 5B-3a (Phase 1): Remove admin JWT/PostgREST write access on payments.
-- Admin reads via payments_select_admin; lifecycle writes remain service_role + booking_* RPCs.
-- Rollback: docs/operations/rls-tightening-rollbacks.md

drop policy if exists payments_admin_write on public.payments;
comment on table public.payments is
  'Payment rows per booking. Status changes via booking_finalize_payment_success / booking_record_payment_failure (service_role). Admin authenticated: SELECT only (5B-3a).';
