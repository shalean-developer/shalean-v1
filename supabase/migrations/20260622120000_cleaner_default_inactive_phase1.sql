-- Workforce Stabilization Phase 1B: new cleaners default inactive until onboarding completes.
-- Existing rows are unchanged; only the column default for future inserts is updated.

alter table public.cleaners
  alter column active set default false;
comment on column public.cleaners.active is
  'Operational flag. Defaults false at provision; set true when admin completes onboarding.';
