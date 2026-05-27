-- Allow admins to reject recurring support requests (triage only; no auto-execution).

alter table public.recurring_series_requests
  drop constraint if exists recurring_series_requests_status_check;
alter table public.recurring_series_requests
  add constraint recurring_series_requests_status_check
  check (status in ('open', 'acknowledged', 'resolved', 'rejected'));
