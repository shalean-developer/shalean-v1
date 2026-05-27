-- Admin dashboard management support:
-- - auth-backed cleaner accounts using generated phone-number email addresses
-- - default Shalean admin auth account/profile seed

create extension if not exists "pgcrypto";

alter table public.cleaners
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists auth_email text unique,
  add column if not exists password_set_at timestamptz;

create index if not exists cleaners_auth_user_id_idx
  on public.cleaners (auth_user_id)
  where auth_user_id is not null;

create index if not exists cleaners_auth_email_idx
  on public.cleaners (auth_email)
  where auth_email is not null;

do $$
declare
  v_admin_id uuid;
  v_admin_email text := 'admin@shalean.co.za';
  v_admin_name text := 'Shalean Cleaning Services Admin';
begin
  select id into v_admin_id
  from auth.users
  where lower(email) = v_admin_email
  limit 1;

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

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
      v_admin_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      crypt('Shalo@Admin2026', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', 'admin'
      ),
      jsonb_build_object(
        'full_name', v_admin_name,
        'seeded_admin', true
      ),
      now(),
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    select
      gen_random_uuid(),
      v_admin_id,
      v_admin_id::text,
      jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email),
      'email',
      now(),
      now(),
      now()
    where exists (
      select 1
      from information_schema.tables
      where table_schema = 'auth'
        and table_name = 'identities'
    );
  end if;

  insert into public.profiles (id, role, full_name)
  values (v_admin_id, 'admin', v_admin_name)
  on conflict (id) do update
  set
    role = 'admin',
    full_name = excluded.full_name,
    updated_at = now();
end $$;

comment on column public.cleaners.auth_user_id is
  'Supabase Auth user id for email/password cleaner sign-in.';
comment on column public.cleaners.auth_email is
  'Generated cleaner login email, usually digits-only phone number at shalean.co.za.';
comment on column public.cleaners.password_set_at is
  'Last time an admin set or reset the cleaner password.';
