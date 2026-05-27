-- Phase 1 integration: remove stale auth sync trigger and seed helper (service_role only).

drop trigger if exists on_auth_user_updated on auth.users;

create or replace function public.phase1_ensure_integration_seed_customer()
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_customer_id uuid;
  v_user_id uuid;
begin
  select id into v_customer_id
  from public.customers
  where company_name = 'test_phase1_integration_seed'
  limit 1;

  if v_customer_id is not null then
    return v_customer_id;
  end if;

  select id into v_customer_id
  from public.customers
  where company_name like 'test_phase1_%'
  order by created_at
  limit 1;

  if v_customer_id is not null then
    return v_customer_id;
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_sent_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'test_phase1_integration_seed@shalean.co.za',
    crypt('integration-test-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'role', 'customer'
    ),
    jsonb_build_object(
      'full_name', 'Phase 1 integration seed',
      'role', 'customer',
      'phase1_integration', true
    ),
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, role, full_name)
  values (v_user_id, 'customer', 'Phase 1 integration seed')
  on conflict (id) do nothing;

  insert into public.customers (profile_id, company_name)
  values (v_user_id, 'test_phase1_integration_seed')
  returning id into v_customer_id;

  return v_customer_id;
end;
$$;

revoke all on function public.phase1_ensure_integration_seed_customer() from public;
grant execute on function public.phase1_ensure_integration_seed_customer() to service_role;;
