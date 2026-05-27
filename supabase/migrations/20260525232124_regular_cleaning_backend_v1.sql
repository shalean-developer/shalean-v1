create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'v1_payment_status') then
    create type public.v1_payment_status as enum ('pending', 'initialized', 'paid', 'failed', 'refunded');
  end if;

  if not exists (select 1 from pg_type where typname = 'v1_booking_status') then
    create type public.v1_booking_status as enum ('draft', 'payment_pending', 'confirmed', 'assigned', 'completed', 'cancelled');
  end if;
end $$;

alter table public.services
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists default_duration_minutes integer not null default 180,
  add column if not exists base_price_cents bigint not null default 0,
  add column if not exists currency text not null default 'ZAR',
  add column if not exists min_hours numeric(5, 2) not null default 3,
  add column if not exists requires_team boolean not null default false;

update public.services
set
  slug = coalesce(slug, lower(regexp_replace(coalesce(title, name), '[^a-zA-Z0-9]+', '-', 'g'))),
  title = coalesce(title, name)
where slug is null
   or title is null;

create unique index if not exists services_slug_unique_idx
  on public.services(slug)
  where slug is not null;

create table if not exists public.service_addons (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  key text not null,
  label text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  workload_weight numeric(5, 2) not null default 1 check (workload_weight >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_slug, key)
);

create table if not exists public.service_equipment_options (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  key text not null,
  label text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  included_items text[] not null default array[]::text[],
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_slug, key)
);

create table if not exists public.cleaner_quantity_rules (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  min_cleaners integer not null default 1 check (min_cleaners >= 1),
  max_cleaners integer not null default 4 check (max_cleaners >= min_cleaners),
  included_cleaners integer not null default 1 check (included_cleaners >= 1),
  extra_cleaner_price_cents integer not null default 0 check (extra_cleaner_price_cents >= 0),
  recommended_workload_minutes_per_cleaner integer not null default 270 check (recommended_workload_minutes_per_cleaner > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_slug)
);

create table if not exists public.regular_cleaning_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  bedrooms integer not null check (bedrooms >= 0),
  bathrooms integer not null check (bathrooms >= 0),
  base_price_cents integer not null check (base_price_cents >= 0),
  estimated_minutes integer not null check (estimated_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bedrooms, bathrooms)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cleaners (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  display_name text,
  photo_url text,
  rating numeric(3, 2) not null default 5 check (rating >= 0 and rating <= 5),
  experience_years integer not null default 0 check (experience_years >= 0),
  available boolean not null default true,
  active boolean not null default true,
  equipment_eligible boolean not null default false,
  service_slugs text[] not null default array['regular-cleaning'],
  suburbs text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cleaners
  add column if not exists full_name text,
  add column if not exists display_name text,
  add column if not exists photo_url text,
  add column if not exists rating numeric(3, 2) not null default 5,
  add column if not exists experience_years integer not null default 0,
  add column if not exists available boolean not null default true,
  add column if not exists active boolean not null default true,
  add column if not exists equipment_eligible boolean not null default false,
  add column if not exists service_slugs text[] not null default array['regular-cleaning'],
  add column if not exists suburbs text[] not null default array[]::text[];

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cleaners'
      and column_name = 'profile_id'
  ) then
    execute 'alter table public.cleaners alter column profile_id drop not null';
  end if;
end $$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  service_slug text not null,
  booking_date date not null,
  booking_time text not null,
  address text not null,
  suburb text not null,
  property_type text not null default 'house',
  bedrooms integer not null check (bedrooms >= 0),
  bathrooms integer not null check (bathrooms >= 0),
  selected_addons jsonb not null default '[]'::jsonb,
  equipment_option text not null default 'without_equipment',
  cleaner_count integer not null default 1 check (cleaner_count >= 1),
  selected_cleaner_id uuid,
  base_price_cents integer not null check (base_price_cents >= 0),
  addons_total_cents integer not null default 0 check (addons_total_cents >= 0),
  equipment_total_cents integer not null default 0 check (equipment_total_cents >= 0),
  extra_cleaners_total_cents integer not null default 0 check (extra_cleaners_total_cents >= 0),
  final_total_cents integer not null check (final_total_cents >= 0),
  payment_status public.v1_payment_status not null default 'pending',
  booking_status public.v1_booking_status not null default 'draft',
  pricing_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists customer_id uuid references public.customers(id),
  add column if not exists service_slug text,
  add column if not exists booking_date date,
  add column if not exists booking_time text,
  add column if not exists address text,
  add column if not exists suburb text,
  add column if not exists property_type text not null default 'house',
  add column if not exists bedrooms integer,
  add column if not exists bathrooms integer,
  add column if not exists selected_addons jsonb not null default '[]'::jsonb,
  add column if not exists equipment_option text not null default 'without_equipment',
  add column if not exists cleaner_count integer not null default 1,
  add column if not exists selected_cleaner_id uuid,
  add column if not exists base_price_cents integer not null default 0,
  add column if not exists addons_total_cents integer not null default 0,
  add column if not exists equipment_total_cents integer not null default 0,
  add column if not exists extra_cleaners_total_cents integer not null default 0,
  add column if not exists final_total_cents integer not null default 0,
  add column if not exists payment_status public.v1_payment_status not null default 'pending',
  add column if not exists booking_status public.v1_booking_status not null default 'draft',
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.booking_addons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  addon_key text not null,
  label text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  unique (booking_id, addon_key)
);

create table if not exists public.booking_equipment (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  equipment_key text not null,
  label text not null,
  price_cents integer not null check (price_cents >= 0),
  included_items text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  unique (booking_id)
);

create table if not exists public.booking_cleaners (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  cleaner_id uuid references public.cleaners(id),
  cleaner_count integer not null default 1 check (cleaner_count >= 1),
  is_preferred boolean not null default false,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_cleaners
  add column if not exists cleaner_count integer not null default 1,
  add column if not exists is_preferred boolean not null default false;

alter table public.booking_cleaners
  alter column cleaner_id drop not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_cleaners'
      and column_name = 'role'
  ) then
    execute 'alter table public.booking_cleaners alter column role set default ''primary''::public.booking_cleaner_role';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_cleaners'
      and column_name = 'status'
  ) then
    execute 'alter table public.booking_cleaners alter column status set default ''planned''::public.booking_cleaner_status';
  end if;
end $$;

alter table public.payments
  add column if not exists provider_ref text,
  add column if not exists provider_reference text,
  add column if not exists currency text not null default 'ZAR',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

insert into public.services
  (slug, title, name, category, description, default_duration_minutes, base_price_cents, currency, active, min_hours, requires_team)
values
  ('regular-cleaning', 'Regular Cleaning', 'Regular Cleaning', 'regular', 'Recurring or once-off home cleaning with premium add-ons, equipment choice, and cleaner selection.', 180, 0, 'ZAR', true, 3, false)
on conflict (slug) where slug is not null do update set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  active = true,
  min_hours = excluded.min_hours,
  requires_team = excluded.requires_team,
  updated_at = now();

insert into public.service_addons
  (service_slug, key, label, description, price_cents, duration_minutes, workload_weight, sort_order)
values
  ('regular-cleaning', 'insideCabinets', 'Inside Cabinets', 'Kitchen and storage cabinet interiors wiped and reset.', 9500, 35, 1.00, 10),
  ('regular-cleaning', 'insideOven', 'Inside Oven', 'Interior oven clean for everyday grease and residue.', 8500, 30, 1.00, 20),
  ('regular-cleaning', 'insideFridge', 'Inside Fridge', 'Shelves, trays, and interior fridge surfaces cleaned.', 7000, 25, 0.80, 30),
  ('regular-cleaning', 'interiorWalls', 'Interior Walls', 'Spot-clean visible wall marks in high-use areas.', 14000, 50, 1.40, 40),
  ('regular-cleaning', 'ironing', 'Ironing', 'Light household ironing folded and staged.', 9000, 40, 1.10, 50),
  ('regular-cleaning', 'laundry', 'Laundry', 'Laundry load support for wash, hang, fold, or rotate.', 9000, 40, 1.00, 60),
  ('regular-cleaning', 'interiorWindows', 'Interior Windows', 'Interior glass, sills, and reachable frames.', 12500, 45, 1.25, 70)
on conflict (service_slug, key) do update set
  label = excluded.label,
  description = excluded.description,
  price_cents = excluded.price_cents,
  duration_minutes = excluded.duration_minutes,
  workload_weight = excluded.workload_weight,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.service_equipment_options
  (service_slug, key, label, description, price_cents, included_items, sort_order)
values
  ('regular-cleaning', 'without_equipment', 'Without Equipment', 'Customer provides suitable equipment and cleaning products.', 0, array[]::text[], 10),
  ('regular-cleaning', 'with_equipment', 'With Equipment', 'Shalean supplies vacuum cleaner, mop & bucket, chemicals, microfiber cloths, and professional tools.', 9000, array['Vacuum cleaner', 'Mop & bucket', 'Cleaning chemicals', 'Microfiber cloths', 'Professional tools'], 20)
on conflict (service_slug, key) do update set
  label = excluded.label,
  description = excluded.description,
  price_cents = excluded.price_cents,
  included_items = excluded.included_items,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.cleaner_quantity_rules
  (service_slug, min_cleaners, max_cleaners, included_cleaners, extra_cleaner_price_cents, recommended_workload_minutes_per_cleaner)
values
  ('regular-cleaning', 1, 4, 1, 18000, 270)
on conflict (service_slug) do update set
  min_cleaners = excluded.min_cleaners,
  max_cleaners = excluded.max_cleaners,
  included_cleaners = excluded.included_cleaners,
  extra_cleaner_price_cents = excluded.extra_cleaner_price_cents,
  recommended_workload_minutes_per_cleaner = excluded.recommended_workload_minutes_per_cleaner,
  active = true,
  updated_at = now();

insert into public.regular_cleaning_pricing_rules
  (bedrooms, bathrooms, base_price_cents, estimated_minutes)
values
  (0, 1, 35000, 150),
  (1, 1, 42000, 180),
  (2, 1, 52000, 210),
  (2, 2, 62000, 240),
  (3, 1, 65000, 255),
  (3, 2, 75000, 285),
  (4, 2, 88000, 330),
  (5, 3, 110000, 390)
on conflict (bedrooms, bathrooms) do update set
  base_price_cents = excluded.base_price_cents,
  estimated_minutes = excluded.estimated_minutes,
  active = true,
  updated_at = now();

insert into public.cleaners
  (display_name, full_name, photo_url, rating, experience_years, available, active, equipment_eligible, service_slugs, suburbs)
values
  ('Nandi M.', 'Nandi M.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80', 4.9, 4, true, true, true, array['regular-cleaning'], array['Sea Point', 'Green Point', 'Claremont', 'Newlands']),
  ('Thabo K.', 'Thabo K.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80', 4.8, 3, true, true, true, array['regular-cleaning'], array['Sea Point', 'Rondebosch', 'Woodstock', 'Observatory']),
  ('Amara S.', 'Amara S.', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=240&q=80', 4.7, 2, true, true, false, array['regular-cleaning'], array['Camps Bay', 'Sea Point', 'Century City', 'Bloubergstrand'])
on conflict do nothing;

alter table public.service_addons enable row level security;
alter table public.service_equipment_options enable row level security;
alter table public.cleaner_quantity_rules enable row level security;
alter table public.regular_cleaning_pricing_rules enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_addons enable row level security;
alter table public.booking_equipment enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_addons' and policyname = 'public can read active service addons') then
    create policy "public can read active service addons"
      on public.service_addons for select
      using (active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_equipment_options' and policyname = 'public can read active equipment options') then
    create policy "public can read active equipment options"
      on public.service_equipment_options for select
      using (active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cleaner_quantity_rules' and policyname = 'public can read active cleaner quantity rules') then
    create policy "public can read active cleaner quantity rules"
      on public.cleaner_quantity_rules for select
      using (active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'regular_cleaning_pricing_rules' and policyname = 'public can read active regular pricing rules') then
    create policy "public can read active regular pricing rules"
      on public.regular_cleaning_pricing_rules for select
      using (active = true);
  end if;
end $$;;
