-- Customer domain hardening (Stage 2).
-- Protective triggers/functions only — no RLS, booking, or payment changes.
-- Prerequisites met: ops:audit:customer-domain exit 0 (228 KEEP).

-- -----------------------------------------------------------------------------
-- 1. Reconcile customer domain when role leaves customer
-- -----------------------------------------------------------------------------
create or replace function public.reconcile_customer_domain_on_role_leave(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_booking_count bigint;
begin
  select c.id into v_customer_id
  from public.customers c
  where c.profile_id = p_profile_id;

  if v_customer_id is null then
    return;
  end if;

  select count(*)::bigint into v_booking_count
  from public.bookings b
  where b.customer_id = v_customer_id;

  if v_booking_count > 0 then
    -- Preserve historical bookings (ON DELETE RESTRICT). Row becomes inert for
    -- customer APIs because profiles.role != customer and RLS keys off role.
    return;
  end if;

  delete from public.customers
  where profile_id = p_profile_id;
end;
$$;
comment on function public.reconcile_customer_domain_on_role_leave(uuid) is
  'Removes stray customers row when profile leaves customer role and has no bookings.';
revoke all on function public.reconcile_customer_domain_on_role_leave(uuid) from public;
grant execute on function public.reconcile_customer_domain_on_role_leave(uuid) to service_role;
-- -----------------------------------------------------------------------------
-- 2. AFTER UPDATE OF role — provision on promote, reconcile on demote
-- -----------------------------------------------------------------------------
create or replace function public.trigger_reconcile_customer_domain_on_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'customer'::public.user_role
     and old.role is distinct from 'customer'::public.user_role then
    perform public.provision_customer_for_profile(new.id);
  elsif old.role = 'customer'::public.user_role
        and new.role is distinct from 'customer'::public.user_role then
    perform public.reconcile_customer_domain_on_role_leave(new.id);
  end if;

  return new;
end;
$$;
drop trigger if exists on_profile_customer_domain_role_reconcile on public.profiles;
create trigger on_profile_customer_domain_role_reconcile
  after update of role on public.profiles
  for each row
  when (old.role is distinct from new.role)
  execute function public.trigger_reconcile_customer_domain_on_profile_role();
-- -----------------------------------------------------------------------------
-- 3. Prevent invalid customer/profile combinations (new writes only)
-- -----------------------------------------------------------------------------
create or replace function public.assert_customer_row_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_cleaner_id uuid;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = new.profile_id;

  if not found then
    raise exception 'customers.profile_id % has no profiles row', new.profile_id
      using errcode = '23503';
  end if;

  if v_role is distinct from 'customer'::public.user_role then
    raise exception 'cannot attach customers row: profiles.role is %, expected customer', v_role
      using errcode = 'check_violation';
  end if;

  select cl.id into v_cleaner_id
  from public.cleaners cl
  where cl.profile_id = new.profile_id;

  if v_cleaner_id is not null then
    raise exception 'cannot attach customers row: profile % already has cleaners row %',
      new.profile_id, v_cleaner_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
drop trigger if exists customers_assert_valid_profile on public.customers;
create trigger customers_assert_valid_profile
  before insert or update of profile_id on public.customers
  for each row
  execute function public.assert_customer_row_allowed();
-- -----------------------------------------------------------------------------
-- 4. Prevent cleaners row when customers row exists (symmetric guard)
-- -----------------------------------------------------------------------------
create or replace function public.assert_cleaner_row_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_customer_id uuid;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = new.profile_id;

  if not found then
    raise exception 'cleaners.profile_id % has no profiles row', new.profile_id
      using errcode = '23503';
  end if;

  if v_role is distinct from 'cleaner'::public.user_role then
    raise exception 'cannot attach cleaners row: profiles.role is %, expected cleaner', v_role
      using errcode = 'check_violation';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.profile_id = new.profile_id;

  if v_customer_id is not null then
    raise exception 'cannot attach cleaners row: profile % already has customers row %',
      new.profile_id, v_customer_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
drop trigger if exists cleaners_assert_valid_profile on public.cleaners;
create trigger cleaners_assert_valid_profile
  before insert or update of profile_id on public.cleaners
  for each row
  execute function public.assert_cleaner_row_allowed();
-- -----------------------------------------------------------------------------
-- 5. Extend provision trigger to also run on role → customer (belt + suspenders)
-- -----------------------------------------------------------------------------
-- Existing on_profile_customer_provision (AFTER INSERT) remains.
-- Role-update path is covered by on_profile_customer_domain_role_reconcile above.;
