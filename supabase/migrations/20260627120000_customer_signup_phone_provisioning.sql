-- Persist customer phone from auth signup metadata when provisioning customers rows.

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
  v_phone_raw text;
  v_phone_e164 text;
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

  select
    coalesce(
      nullif(trim(v_profile.full_name), ''),
      nullif(trim(u.email), ''),
      'Customer'
    ),
    nullif(trim(u.raw_user_meta_data->>'phone'), '')
  into v_company_name, v_phone_raw
  from auth.users u
  where u.id = p_profile_id;

  if v_company_name is null then
    v_company_name := 'Customer';
  end if;

  if v_phone_raw is not null and v_phone_raw ~ '^\+27[6-8][0-9]{8}$' then
    v_phone_e164 := v_phone_raw;
  else
    v_phone_e164 := null;
  end if;

  insert into public.customers (profile_id, company_name, phone)
  values (p_profile_id, v_company_name, v_phone_e164)
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
  'Idempotently creates a customers row for a customer profile. Reads normalized phone from auth.users raw_user_meta_data when present.';
