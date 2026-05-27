alter table public.bookings
  add column if not exists checkout_session_id uuid;

alter table public.booking_recurring_series
  add column if not exists checkout_session_id uuid;

alter table public.payments
  add column if not exists checkout_session_id uuid;

create index if not exists bookings_checkout_session_idx
  on public.bookings(checkout_session_id);

create unique index if not exists payments_checkout_session_unique_idx
  on public.payments(checkout_session_id)
  where checkout_session_id is not null;

create unique index if not exists booking_recurring_series_checkout_session_unique_idx
  on public.booking_recurring_series(checkout_session_id)
  where checkout_session_id is not null;

create table if not exists public.cleaner_login_attempts (
  phone text primary key,
  failed_count integer not null default 0 check (failed_count >= 0),
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cleaner_login_attempts enable row level security;

grant all privileges on table public.cleaner_login_attempts to service_role;

revoke select on table public.booking_recurring_series from anon;

grant select on table
  public.customers,
  public.bookings,
  public.booking_addons,
  public.booking_equipment,
  public.booking_cleaners,
  public.payments,
  public.booking_recurring_series
to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers can read own customer profile'
  ) then
    create policy "customers can read own customer profile"
      on public.customers for select
      using (auth_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'customers can read own v1 bookings'
  ) then
    create policy "customers can read own v1 bookings"
      on public.bookings for select
      using (
        exists (
          select 1 from public.customers
          where customers.id = bookings.customer_id
            and customers.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_addons'
      and policyname = 'customers can read own booking addons'
  ) then
    create policy "customers can read own booking addons"
      on public.booking_addons for select
      using (
        exists (
          select 1
          from public.bookings
          join public.customers on customers.id = bookings.customer_id
          where bookings.id = booking_addons.booking_id
            and customers.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_equipment'
      and policyname = 'customers can read own booking equipment'
  ) then
    create policy "customers can read own booking equipment"
      on public.booking_equipment for select
      using (
        exists (
          select 1
          from public.bookings
          join public.customers on customers.id = bookings.customer_id
          where bookings.id = booking_equipment.booking_id
            and customers.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_cleaners'
      and policyname = 'customers can read own booking cleaner requests'
  ) then
    create policy "customers can read own booking cleaner requests"
      on public.booking_cleaners for select
      using (
        exists (
          select 1
          from public.bookings
          join public.customers on customers.id = bookings.customer_id
          where bookings.id = booking_cleaners.booking_id
            and customers.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'customers can read own payments'
  ) then
    create policy "customers can read own payments"
      on public.payments for select
      using (
        exists (
          select 1
          from public.bookings
          join public.customers on customers.id = bookings.customer_id
          where bookings.id = payments.booking_id
            and customers.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_recurring_series'
      and policyname = 'customers can read own recurring series'
  ) then
    create policy "customers can read own recurring series"
      on public.booking_recurring_series for select
      using (
        exists (
          select 1 from public.customers
          where customers.id = booking_recurring_series.customer_id
            and customers.auth_user_id = auth.uid()
        )
      );
  end if;
end $$;
