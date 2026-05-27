-- Phase 2: Row Level Security and role-scoped access.
-- Booking status changes remain on the command/RPC/service-role path only.

-- ---------------------------------------------------------------------------
-- Auth helpers (security definer — avoid RLS recursion in policies)
-- ---------------------------------------------------------------------------

create or replace function public.auth_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;
revoke all on function public.auth_profile_id() from public;
grant execute on function public.auth_profile_id() to authenticated, anon, service_role;
create or replace function public.auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;
revoke all on function public.auth_is_admin() from public;
grant execute on function public.auth_is_admin() to authenticated, anon, service_role;
create or replace function public.auth_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.customers c
  where c.profile_id = auth.uid()
  limit 1;
$$;
revoke all on function public.auth_customer_id() from public;
grant execute on function public.auth_customer_id() to authenticated, service_role;
create or replace function public.auth_cleaner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cl.id
  from public.cleaners cl
  where cl.profile_id = auth.uid()
  limit 1;
$$;
revoke all on function public.auth_cleaner_id() from public;
grant execute on function public.auth_cleaner_id() to authenticated, service_role;
create or replace function public.cleaner_can_access_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.id = p_booking_id
      and (
        b.cleaner_id = public.auth_cleaner_id()
        or exists (
          select 1
          from public.assignment_offers ao
          where ao.booking_id = b.id
            and ao.cleaner_id = public.auth_cleaner_id()
        )
      )
  );
$$;
revoke all on function public.cleaner_can_access_booking(uuid) from public;
grant execute on function public.cleaner_can_access_booking(uuid) to authenticated, service_role;
create or replace function public.customer_owns_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.id = p_booking_id
      and b.customer_id = public.auth_customer_id()
  );
$$;
revoke all on function public.customer_owns_booking(uuid) from public;
grant execute on function public.customer_owns_booking(uuid) to authenticated, service_role;
-- ---------------------------------------------------------------------------
-- Guards: booking status + assignment offer field restrictions
-- ---------------------------------------------------------------------------

create or replace function public.guard_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status and auth.uid() is not null then
    raise exception 'BOOKING_STATUS_MUTATION_FORBIDDEN';
  end if;

  if tg_op = 'INSERT' and auth.uid() is not null and new.status is distinct from 'draft'::public.booking_status then
    raise exception 'BOOKING_STATUS_MUTATION_FORBIDDEN';
  end if;

  return new;
end;
$$;
drop trigger if exists guard_booking_status_change on public.bookings;
create trigger guard_booking_status_change
  before insert or update on public.bookings
  for each row
  execute function public.guard_booking_status_change();
create or replace function public.guard_assignment_offer_cleaner_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cleaner_id uuid := public.auth_cleaner_id();
begin
  if tg_op <> 'UPDATE' or v_cleaner_id is null then
    return new;
  end if;

  if old.cleaner_id is distinct from v_cleaner_id then
    return new;
  end if;

  if new.booking_id is distinct from old.booking_id
     or new.cleaner_id is distinct from old.cleaner_id
     or new.offered_at is distinct from old.offered_at
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'ASSIGNMENT_OFFER_FIELD_MUTATION_FORBIDDEN';
  end if;

  return new;
end;
$$;
drop trigger if exists guard_assignment_offer_cleaner_update on public.assignment_offers;
create trigger guard_assignment_offer_cleaner_update
  before update on public.assignment_offers
  for each row
  execute function public.guard_assignment_offer_cleaner_update();
-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.cleaners enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.assignment_offers enable row level security;
alter table public.earning_lines enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.booking_state_audit enable row level security;
-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.auth_is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.auth_is_admin())
  with check (
    id = auth.uid()
    and (
      public.auth_is_admin()
      or role = (select p.role from public.profiles p where p.id = auth.uid())
    )
  );
-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (profile_id = auth.uid() or public.auth_is_admin());
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (profile_id = auth.uid() or public.auth_is_admin())
  with check (profile_id = auth.uid() or public.auth_is_admin());
drop policy if exists customers_admin_insert on public.customers;
create policy customers_admin_insert on public.customers
  for insert to authenticated
  with check (public.auth_is_admin());
drop policy if exists customers_admin_delete on public.customers;
create policy customers_admin_delete on public.customers
  for delete to authenticated
  using (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- cleaners
-- ---------------------------------------------------------------------------

drop policy if exists cleaners_select on public.cleaners;
create policy cleaners_select on public.cleaners
  for select to authenticated
  using (profile_id = auth.uid() or public.auth_is_admin());
drop policy if exists cleaners_update on public.cleaners;
create policy cleaners_update on public.cleaners
  for update to authenticated
  using (profile_id = auth.uid() or public.auth_is_admin())
  with check (profile_id = auth.uid() or public.auth_is_admin());
drop policy if exists cleaners_admin_insert on public.cleaners;
create policy cleaners_admin_insert on public.cleaners
  for insert to authenticated
  with check (public.auth_is_admin());
drop policy if exists cleaners_admin_delete on public.cleaners;
create policy cleaners_admin_delete on public.cleaners
  for delete to authenticated
  using (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- services (public catalog read for active rows)
-- ---------------------------------------------------------------------------

drop policy if exists services_select_active on public.services;
create policy services_select_active on public.services
  for select to anon, authenticated
  using (active = true or public.auth_is_admin());
drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

drop policy if exists bookings_select_customer on public.bookings;
create policy bookings_select_customer on public.bookings
  for select to authenticated
  using (customer_id = public.auth_customer_id());
drop policy if exists bookings_select_cleaner on public.bookings;
create policy bookings_select_cleaner on public.bookings
  for select to authenticated
  using (public.cleaner_can_access_booking(id));
drop policy if exists bookings_select_admin on public.bookings;
create policy bookings_select_admin on public.bookings
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists bookings_update_customer on public.bookings;
create policy bookings_update_customer on public.bookings
  for update to authenticated
  using (customer_id = public.auth_customer_id())
  with check (customer_id = public.auth_customer_id());
drop policy if exists bookings_admin_write on public.bookings;
create policy bookings_admin_write on public.bookings
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

drop policy if exists payments_select_customer on public.payments;
create policy payments_select_customer on public.payments
  for select to authenticated
  using (public.customer_owns_booking(booking_id));
drop policy if exists payments_select_admin on public.payments;
create policy payments_select_admin on public.payments
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists payments_admin_write on public.payments;
create policy payments_admin_write on public.payments
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- payment_events
-- ---------------------------------------------------------------------------

drop policy if exists payment_events_select_customer on public.payment_events;
create policy payment_events_select_customer on public.payment_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.payments p
      where p.id = payment_events.payment_id
        and public.customer_owns_booking(p.booking_id)
    )
  );
drop policy if exists payment_events_select_admin on public.payment_events;
create policy payment_events_select_admin on public.payment_events
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists payment_events_admin_write on public.payment_events;
create policy payment_events_admin_write on public.payment_events
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- assignment_offers
-- ---------------------------------------------------------------------------

drop policy if exists assignment_offers_select_cleaner on public.assignment_offers;
create policy assignment_offers_select_cleaner on public.assignment_offers
  for select to authenticated
  using (cleaner_id = public.auth_cleaner_id());
drop policy if exists assignment_offers_select_customer on public.assignment_offers;
create policy assignment_offers_select_customer on public.assignment_offers
  for select to authenticated
  using (public.customer_owns_booking(booking_id));
drop policy if exists assignment_offers_select_admin on public.assignment_offers;
create policy assignment_offers_select_admin on public.assignment_offers
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists assignment_offers_update_cleaner on public.assignment_offers;
create policy assignment_offers_update_cleaner on public.assignment_offers
  for update to authenticated
  using (cleaner_id = public.auth_cleaner_id())
  with check (cleaner_id = public.auth_cleaner_id());
drop policy if exists assignment_offers_admin_write on public.assignment_offers;
create policy assignment_offers_admin_write on public.assignment_offers
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- earning_lines
-- ---------------------------------------------------------------------------

drop policy if exists earning_lines_select_cleaner on public.earning_lines;
create policy earning_lines_select_cleaner on public.earning_lines
  for select to authenticated
  using (cleaner_id = public.auth_cleaner_id());
drop policy if exists earning_lines_select_admin on public.earning_lines;
create policy earning_lines_select_admin on public.earning_lines
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists earning_lines_admin_write on public.earning_lines;
create policy earning_lines_admin_write on public.earning_lines
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- notification_outbox (service role / admin only)
-- ---------------------------------------------------------------------------

drop policy if exists notification_outbox_admin on public.notification_outbox;
create policy notification_outbox_admin on public.notification_outbox
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
-- ---------------------------------------------------------------------------
-- booking_state_audit (read for involved parties; writes via RPC/service role)
-- ---------------------------------------------------------------------------

drop policy if exists booking_state_audit_select_customer on public.booking_state_audit;
create policy booking_state_audit_select_customer on public.booking_state_audit
  for select to authenticated
  using (public.customer_owns_booking(booking_id));
drop policy if exists booking_state_audit_select_cleaner on public.booking_state_audit;
create policy booking_state_audit_select_cleaner on public.booking_state_audit
  for select to authenticated
  using (public.cleaner_can_access_booking(booking_id));
drop policy if exists booking_state_audit_select_admin on public.booking_state_audit;
create policy booking_state_audit_select_admin on public.booking_state_audit
  for select to authenticated
  using (public.auth_is_admin());
comment on function public.guard_booking_status_change is
  'Blocks authenticated sessions from changing bookings.status; command RPCs use service_role (auth.uid() is null).';
