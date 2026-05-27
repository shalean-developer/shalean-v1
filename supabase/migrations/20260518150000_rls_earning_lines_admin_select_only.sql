-- Stage 5B-3b-a: Remove admin JWT/PostgREST write access on earning_lines.
-- Admin reads via earning_lines_select_admin; lifecycle writes remain service_role + commands.
-- Rollback: docs/operations/rls-tightening-rollbacks.md

drop policy if exists earning_lines_admin_write on public.earning_lines;
comment on table public.earning_lines is
  'Earnings ledger. Lifecycle writes via service_role + booking commands. Admin authenticated: SELECT only (5B-3b-a).';
