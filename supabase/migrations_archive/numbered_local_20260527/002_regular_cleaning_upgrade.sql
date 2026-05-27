create table if not exists public.service_add_on_configs (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null references public.services(slug) on delete cascade,
  key text not null,
  label text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  duration_hours numeric(4, 2) not null default 0 check (duration_hours >= 0),
  workload_weight numeric(4, 2) not null default 1 check (workload_weight >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_slug, key)
);

create table if not exists public.service_equipment_configs (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null references public.services(slug) on delete cascade,
  label text not null default 'Cleaning Equipment',
  price_cents integer not null check (price_cents >= 0),
  duration_hours numeric(4, 2) not null default 0 check (duration_hours >= 0),
  included_items text[] not null default array[]::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_slug)
);

create table if not exists public.cleaner_equipment_eligibility (
  cleaner_id uuid primary key references public.cleaners(id) on delete cascade,
  vacuum_cleaner boolean not null default false,
  mop_bucket boolean not null default false,
  cleaning_chemicals boolean not null default false,
  microfiber_cloths boolean not null default false,
  professional_tools boolean not null default false,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists equipment_mode text not null default 'without_equipment',
  add column if not exists equipment_items text[] not null default array[]::text[],
  add column if not exists selected_cleaner_ids uuid[] not null default array[]::uuid[];

insert into public.services
  (slug, title, category, base_cents, min_hours, requires_team, active)
values
  ('regular-cleaning', 'Regular Cleaning', 'regular', 42000, 3, false, true)
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  base_cents = excluded.base_cents,
  min_hours = excluded.min_hours,
  requires_team = excluded.requires_team,
  active = true;

insert into public.service_add_on_configs
  (service_slug, key, label, description, price_cents, duration_hours, workload_weight)
values
  ('regular-cleaning', 'insideCabinets', 'Inside Cabinets', 'Kitchen and storage cabinet interiors wiped and reset.', 9500, 0.55, 1.00),
  ('regular-cleaning', 'insideOven', 'Inside Oven', 'Interior oven clean for everyday grease and residue.', 8500, 0.50, 1.00),
  ('regular-cleaning', 'insideFridge', 'Inside Fridge', 'Shelves, trays, and interior fridge surfaces cleaned.', 7000, 0.40, 0.80),
  ('regular-cleaning', 'interiorWalls', 'Interior Walls', 'Spot-clean visible wall marks in high-use areas.', 14000, 0.80, 1.40),
  ('regular-cleaning', 'ironing', 'Ironing', 'Light household ironing folded and staged.', 9000, 0.70, 1.10),
  ('regular-cleaning', 'laundry', 'Laundry', 'Laundry load support for wash, hang, fold, or rotate.', 9000, 0.65, 1.00),
  ('regular-cleaning', 'interiorWindows', 'Interior Windows', 'Interior glass, sills, and reachable frames.', 12500, 0.75, 1.25)
on conflict (service_slug, key) do update set
  label = excluded.label,
  description = excluded.description,
  price_cents = excluded.price_cents,
  duration_hours = excluded.duration_hours,
  workload_weight = excluded.workload_weight,
  active = true,
  updated_at = now();

insert into public.service_equipment_configs
  (service_slug, label, price_cents, duration_hours, included_items)
values
  (
    'regular-cleaning',
    'Cleaning Equipment',
    9000,
    0.15,
    array['Vacuum cleaner', 'Mop & bucket', 'Cleaning chemicals', 'Microfiber cloths', 'Professional tools']
  )
on conflict (service_slug) do update set
  label = excluded.label,
  price_cents = excluded.price_cents,
  duration_hours = excluded.duration_hours,
  included_items = excluded.included_items,
  active = true,
  updated_at = now();

create index if not exists service_add_on_configs_service_idx
  on public.service_add_on_configs(service_slug, active);

create index if not exists bookings_equipment_mode_idx
  on public.bookings(equipment_mode);
