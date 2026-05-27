-- Customer booking support requests (admin-reviewed; never auto-mutates bookings).

create table if not exists public.booking_support_requests (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,

  request_type text not null check (
    request_type in (
      'reschedule',
      'cancel',
      'payment_help',
      'cleaner_issue',
      'service_issue',
      'general_message'
    )
  ),
  status text not null default 'open' check (
    status in ('open', 'acknowledged', 'resolved', 'rejected')
  ),

  message text,
  preferred_new_time timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);
comment on table public.booking_support_requests is
  'Customer support requests for individual bookings. Admin acts manually; requests never auto-execute booking changes.';
create index if not exists idx_booking_support_requests_booking_status
  on public.booking_support_requests (booking_id, status, created_at desc);
create index if not exists idx_booking_support_requests_customer
  on public.booking_support_requests (customer_id, created_at desc);
create index if not exists idx_booking_support_requests_open
  on public.booking_support_requests (status, created_at desc)
  where status in ('open', 'acknowledged');
create or replace function public.set_booking_support_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_booking_support_requests_updated_at on public.booking_support_requests;
create trigger trg_booking_support_requests_updated_at
  before update on public.booking_support_requests
  for each row
  execute function public.set_booking_support_requests_updated_at();
alter table public.booking_support_requests enable row level security;
drop policy if exists booking_support_requests_select_admin on public.booking_support_requests;
create policy booking_support_requests_select_admin on public.booking_support_requests
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists booking_support_requests_select_customer on public.booking_support_requests;
create policy booking_support_requests_select_customer on public.booking_support_requests
  for select to authenticated
  using (customer_id = public.auth_customer_id());
drop policy if exists booking_support_requests_insert_customer on public.booking_support_requests;
create policy booking_support_requests_insert_customer on public.booking_support_requests
  for insert to authenticated
  with check (
    customer_id = public.auth_customer_id()
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and b.customer_id = public.auth_customer_id()
    )
  );
drop policy if exists booking_support_requests_update_admin on public.booking_support_requests;
create policy booking_support_requests_update_admin on public.booking_support_requests
  for update to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
grant select, insert on public.booking_support_requests to authenticated, service_role;
grant update on public.booking_support_requests to authenticated, service_role;
