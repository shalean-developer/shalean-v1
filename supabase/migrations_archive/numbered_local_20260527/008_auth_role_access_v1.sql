create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('customer', 'cleaner', 'admin', 'dispatcher', 'finance');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

alter table public.cleaners
  add column if not exists phone text,
  add column if not exists created_by_admin_id uuid references public.profiles(id),
  add column if not exists last_login_at timestamptz;

create table if not exists public.cleaner_credentials (
  cleaner_id uuid primary key references public.cleaners(id) on delete cascade,
  phone text not null unique,
  pin_hash text not null,
  pin_salt text not null,
  created_by_admin_id uuid references public.profiles(id),
  last_pin_reset_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cleaner_sessions (
  token_hash text primary key,
  cleaner_id uuid not null references public.cleaners(id) on delete cascade,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists cleaner_sessions_cleaner_idx
  on public.cleaner_sessions(cleaner_id);

create index if not exists cleaner_sessions_expires_idx
  on public.cleaner_sessions(expires_at);

alter table public.profiles enable row level security;
alter table public.cleaner_credentials enable row level security;
alter table public.cleaner_sessions enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on table public.profiles to service_role;
grant all privileges on table public.cleaner_credentials to service_role;
grant all privileges on table public.cleaner_sessions to service_role;
grant select on table public.profiles to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles can read own profile'
  ) then
    create policy "profiles can read own profile"
      on public.profiles for select
      using (auth.uid() = id);
  end if;
end $$;
