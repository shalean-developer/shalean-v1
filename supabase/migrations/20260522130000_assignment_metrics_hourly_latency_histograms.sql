-- Stage 7B-1c-b: Cleaner response and time-to-first-offer duration histograms (additive).

alter table public.assignment_metrics_hourly
  add column if not exists cleaner_response_bucket_0_15m_count integer not null default 0
    check (cleaner_response_bucket_0_15m_count >= 0),
  add column if not exists cleaner_response_bucket_15_60m_count integer not null default 0
    check (cleaner_response_bucket_15_60m_count >= 0),
  add column if not exists cleaner_response_bucket_1_4h_count integer not null default 0
    check (cleaner_response_bucket_1_4h_count >= 0),
  add column if not exists cleaner_response_bucket_4_12h_count integer not null default 0
    check (cleaner_response_bucket_4_12h_count >= 0),
  add column if not exists cleaner_response_bucket_12_24h_count integer not null default 0
    check (cleaner_response_bucket_12_24h_count >= 0),
  add column if not exists cleaner_response_bucket_24_48h_count integer not null default 0
    check (cleaner_response_bucket_24_48h_count >= 0),
  add column if not exists cleaner_response_bucket_48h_plus_count integer not null default 0
    check (cleaner_response_bucket_48h_plus_count >= 0),
  add column if not exists cleaner_response_sample_count integer not null default 0
    check (cleaner_response_sample_count >= 0),
  add column if not exists time_to_first_offer_bucket_0_15m_count integer not null default 0
    check (time_to_first_offer_bucket_0_15m_count >= 0),
  add column if not exists time_to_first_offer_bucket_15_60m_count integer not null default 0
    check (time_to_first_offer_bucket_15_60m_count >= 0),
  add column if not exists time_to_first_offer_bucket_1_4h_count integer not null default 0
    check (time_to_first_offer_bucket_1_4h_count >= 0),
  add column if not exists time_to_first_offer_bucket_4_12h_count integer not null default 0
    check (time_to_first_offer_bucket_4_12h_count >= 0),
  add column if not exists time_to_first_offer_bucket_12_24h_count integer not null default 0
    check (time_to_first_offer_bucket_12_24h_count >= 0),
  add column if not exists time_to_first_offer_bucket_24_48h_count integer not null default 0
    check (time_to_first_offer_bucket_24_48h_count >= 0),
  add column if not exists time_to_first_offer_bucket_48h_plus_count integer not null default 0
    check (time_to_first_offer_bucket_48h_plus_count >= 0),
  add column if not exists time_to_first_offer_sample_count integer not null default 0
    check (time_to_first_offer_sample_count >= 0);
comment on column public.assignment_metrics_hourly.cleaner_response_sample_count is
  'Cleaner response durations (accepted/declined) in bucket (7B-1c-b).';
comment on column public.assignment_metrics_hourly.time_to_first_offer_sample_count is
  'Time-to-first-offer durations in bucket (7B-1c-b).';
