-- Stage 5B-3c-a: Remove admin JWT/PostgREST write access on assignment_offers.
-- Admin/customer/cleaner SELECT and cleaner UPDATE policies unchanged; writes via service_role + commands.
-- Rollback: docs/operations/rls-tightening-rollbacks.md

drop policy if exists assignment_offers_admin_write on public.assignment_offers;
comment on table public.assignment_offers is
  'Per-cleaner offers before assignment. Lifecycle writes via service_role + booking commands; cron expiry in expireOffers.ts. Admin authenticated: SELECT only (5B-3c-a).';
