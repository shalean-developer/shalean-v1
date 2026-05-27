-- Stage 1C-2: Auto-provision customers rows for customer profiles.

create or replace function public.provision_customer_for_profile(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_customer_id uuid;
  v_company_name text;
begin
  select * into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    return null;
  end if;

  if v_profile.role is distinct from 'customer'::public.user_role then
    return null;
  end if;

  select coalesce(
    nullif(trim(v_profile.full_name), ''),
    nullif(trim(u.email), ''),
    'Customer'
  )
  into v_company_name
  from auth.users u
  where u.id = p_profile_id;

  if v_company_name is null then
    v_company_name := 'Customer';
  end if;

  insert into public.customers (profile_id, company_name)
  values (p_profile_id, v_company_name)
  on conflict (profile_id) do nothing
  returning id into v_customer_id;

  if v_customer_id is null then
    select c.id into v_customer_id
    from public.customers c
    where c.profile_id = p_profile_id;
  end if;

  return v_customer_id;
end;
$$;
comment on function public.provision_customer_for_profile(uuid) is
  'Idempotently creates a customers row for a customer profile. Returns customers.id or null when not applicable.';
create or replace function public.trigger_provision_customer_on_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'customer'::public.user_role then
    perform public.provision_customer_for_profile(new.id);
  end if;

  return new;
end;
$$;
drop trigger if exists on_profile_customer_provision on public.profiles;
create trigger on_profile_customer_provision
  after insert on public.profiles
  for each row
  execute function public.trigger_provision_customer_on_profile();
create or replace function public.ensure_customer_provisioned(profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is not null
     and auth.uid() is distinct from profile_id
     and not public.auth_is_admin() then
    return null;
  end if;

  return public.provision_customer_for_profile(profile_id);
end;
$$;
comment on function public.ensure_customer_provisioned(uuid) is
  'Repair RPC: provisions a customers row for the given customer profile. Safe to call repeatedly.';
revoke all on function public.provision_customer_for_profile(uuid) from public;
grant execute on function public.provision_customer_for_profile(uuid) to service_role;
revoke all on function public.ensure_customer_provisioned(uuid) from public;
grant execute on function public.ensure_customer_provisioned(uuid) to authenticated, service_role;
-- Idempotent backfill for existing customer profiles missing a customers row.
do $$
declare
  v_profile_id uuid;
begin
  for v_profile_id in
    select p.id
    from public.profiles p
    left join public.customers c on c.profile_id = p.id
    where p.role = 'customer'::public.user_role
      and c.id is null
  loop
    perform public.provision_customer_for_profile(v_profile_id);
  end loop;
end;
$$;
