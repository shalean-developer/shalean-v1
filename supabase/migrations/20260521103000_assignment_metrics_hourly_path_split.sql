-- Stage 7B-1b-min: Path-split offer funnel counters on assignment_metrics_hourly (additive).

alter table public.assignment_metrics_hourly
  add column if not exists offers_created_selected_count integer not null default 0
    check (offers_created_selected_count >= 0),
  add column if not exists offers_created_best_available_count integer not null default 0
    check (offers_created_best_available_count >= 0),
  add column if not exists offers_created_admin_manual_count integer not null default 0
    check (offers_created_admin_manual_count >= 0),
  add column if not exists offers_created_unknown_count integer not null default 0
    check (offers_created_unknown_count >= 0),
  add column if not exists offers_accepted_selected_count integer not null default 0
    check (offers_accepted_selected_count >= 0),
  add column if not exists offers_accepted_best_available_count integer not null default 0
    check (offers_accepted_best_available_count >= 0),
  add column if not exists offers_accepted_admin_manual_count integer not null default 0
    check (offers_accepted_admin_manual_count >= 0),
  add column if not exists offers_accepted_unknown_count integer not null default 0
    check (offers_accepted_unknown_count >= 0);
comment on column public.assignment_metrics_hourly.offers_created_selected_count is
  'Offers with offered_at in bucket where assignment path resolved to selected (7B-1b-min).';
