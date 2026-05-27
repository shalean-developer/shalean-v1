-- Customer-visible admin response + private admin notes for support requests.

alter table public.booking_support_requests
  add column if not exists customer_response text,
  add column if not exists responded_at timestamptz,
  add column if not exists admin_notes text;
comment on column public.booking_support_requests.customer_response is
  'Optional message shown to the customer when request is resolved or rejected.';
comment on column public.booking_support_requests.responded_at is
  'When customer_response was last set by admin.';
comment on column public.booking_support_requests.admin_notes is
  'Internal admin notes — never exposed to customers.';
alter table public.recurring_series_requests
  add column if not exists customer_response text,
  add column if not exists responded_at timestamptz,
  add column if not exists admin_notes text;
comment on column public.recurring_series_requests.customer_response is
  'Optional message shown to the customer when request is resolved or rejected.';
comment on column public.recurring_series_requests.responded_at is
  'When customer_response was last set by admin.';
comment on column public.recurring_series_requests.admin_notes is
  'Internal admin notes — never exposed to customers.';
alter table public.recurring_series_requests
  add column if not exists updated_at timestamptz not null default now();
create or replace function public.set_recurring_series_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_recurring_series_requests_updated_at on public.recurring_series_requests;
create trigger trg_recurring_series_requests_updated_at
  before update on public.recurring_series_requests
  for each row
  execute function public.set_recurring_series_requests_updated_at();
