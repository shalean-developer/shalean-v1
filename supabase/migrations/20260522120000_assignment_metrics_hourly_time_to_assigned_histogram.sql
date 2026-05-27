-- Stage 7B-1c-b-min: Time-to-assigned duration histogram on assignment_metrics_hourly (additive).

alter table public.assignment_metrics_hourly
  add column if not exists time_to_assigned_bucket_0_15m_count integer not null default 0
    check (time_to_assigned_bucket_0_15m_count >= 0),
  add column if not exists time_to_assigned_bucket_15_60m_count integer not null default 0
    check (time_to_assigned_bucket_15_60m_count >= 0),
  add column if not exists time_to_assigned_bucket_1_4h_count integer not null default 0
    check (time_to_assigned_bucket_1_4h_count >= 0),
  add column if not exists time_to_assigned_bucket_4_12h_count integer not null default 0
    check (time_to_assigned_bucket_4_12h_count >= 0),
  add column if not exists time_to_assigned_bucket_12_24h_count integer not null default 0
    check (time_to_assigned_bucket_12_24h_count >= 0),
  add column if not exists time_to_assigned_bucket_24_48h_count integer not null default 0
    check (time_to_assigned_bucket_24_48h_count >= 0),
  add column if not exists time_to_assigned_bucket_48h_plus_count integer not null default 0
    check (time_to_assigned_bucket_48h_plus_count >= 0),
  add column if not exists time_to_assigned_sample_count integer not null default 0
    check (time_to_assigned_sample_count >= 0);
comment on column public.assignment_metrics_hourly.time_to_assigned_bucket_0_15m_count is
  'Time-to-assigned durations 0–15m in bucket (7B-1c-b-min).';
comment on column public.assignment_metrics_hourly.time_to_assigned_sample_count is
  'Count of time-to-assigned observations in bucket; equals sum of bucket columns (7B-1c-b-min).';
