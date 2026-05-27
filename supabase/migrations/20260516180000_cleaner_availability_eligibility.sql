-- Phase 5: cleaner availability, service areas, capabilities, suspension, and lookup indexes.

alter table public.cleaners
  add column if not exists suspended_at timestamptz,
  add column if not exists average_rating numeric(3, 2)
    check (average_rating is null or (average_rating >= 0 and average_rating <= 5));
comment on column public.cleaners.suspended_at is
  'When set and in the past, cleaner is blocked from eligibility and assignment.';
create table if not exists public.cleaner_service_areas (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  area_slug text not null,
  created_at timestamptz not null default now(),
  constraint cleaner_service_areas_unique unique (cleaner_id, area_slug)
);
comment on table public.cleaner_service_areas is
  'Suburbs/areas a cleaner serves. Empty set means all areas (see eligibility module).';
create table if not exists public.cleaner_service_capabilities (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  service_slug text not null,
  created_at timestamptz not null default now(),
  constraint cleaner_service_capabilities_unique unique (cleaner_id, service_slug)
);
comment on table public.cleaner_service_capabilities is
  'Service types a cleaner can perform (matches pricing serviceSlug).';
create table if not exists public.cleaner_availability (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Africa/Johannesburg',
  created_at timestamptz not null default now(),
  constraint cleaner_availability_time_range check (end_time > start_time)
);
comment on table public.cleaner_availability is
  'Recurring weekly availability windows (0 = Sunday … 6 = Saturday).';
create table if not exists public.cleaner_time_off (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint cleaner_time_off_range check (end_at > start_at)
);
comment on table public.cleaner_time_off is
  'One-off unavailability blocks (leave, sick, etc.).';
create index if not exists idx_cleaner_service_areas_area_slug
  on public.cleaner_service_areas (area_slug);
create index if not exists idx_cleaner_service_areas_cleaner_id
  on public.cleaner_service_areas (cleaner_id);
create index if not exists idx_cleaner_service_capabilities_service_slug
  on public.cleaner_service_capabilities (service_slug);
create index if not exists idx_cleaner_service_capabilities_cleaner_id
  on public.cleaner_service_capabilities (cleaner_id);
create index if not exists idx_cleaner_availability_cleaner_day
  on public.cleaner_availability (cleaner_id, day_of_week);
create index if not exists idx_cleaner_time_off_cleaner_range
  on public.cleaner_time_off (cleaner_id, start_at, end_at);
-- RLS: cleaners read own rows; admin full; customers use server APIs only (no direct read).

alter table public.cleaner_service_areas enable row level security;
alter table public.cleaner_service_capabilities enable row level security;
alter table public.cleaner_availability enable row level security;
alter table public.cleaner_time_off enable row level security;
drop policy if exists cleaner_service_areas_select on public.cleaner_service_areas;
create policy cleaner_service_areas_select on public.cleaner_service_areas
  for select to authenticated
  using (
    cleaner_id = public.auth_cleaner_id()
    or public.auth_is_admin()
  );
drop policy if exists cleaner_service_areas_admin_write on public.cleaner_service_areas;
create policy cleaner_service_areas_admin_write on public.cleaner_service_areas
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
drop policy if exists cleaner_service_capabilities_select on public.cleaner_service_capabilities;
create policy cleaner_service_capabilities_select on public.cleaner_service_capabilities
  for select to authenticated
  using (
    cleaner_id = public.auth_cleaner_id()
    or public.auth_is_admin()
  );
drop policy if exists cleaner_service_capabilities_admin_write on public.cleaner_service_capabilities;
create policy cleaner_service_capabilities_admin_write on public.cleaner_service_capabilities
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
drop policy if exists cleaner_availability_select on public.cleaner_availability;
create policy cleaner_availability_select on public.cleaner_availability
  for select to authenticated
  using (
    cleaner_id = public.auth_cleaner_id()
    or public.auth_is_admin()
  );
drop policy if exists cleaner_availability_admin_write on public.cleaner_availability;
create policy cleaner_availability_admin_write on public.cleaner_availability
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
drop policy if exists cleaner_time_off_select on public.cleaner_time_off;
create policy cleaner_time_off_select on public.cleaner_time_off
  for select to authenticated
  using (
    cleaner_id = public.auth_cleaner_id()
    or public.auth_is_admin()
  );
drop policy if exists cleaner_time_off_admin_write on public.cleaner_time_off;
create policy cleaner_time_off_admin_write on public.cleaner_time_off
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
grant select on public.cleaner_service_areas to authenticated, service_role;
grant select on public.cleaner_service_capabilities to authenticated, service_role;
grant select on public.cleaner_availability to authenticated, service_role;
grant select on public.cleaner_time_off to authenticated, service_role;
grant all on public.cleaner_service_areas to service_role;
grant all on public.cleaner_service_capabilities to service_role;
grant all on public.cleaner_availability to service_role;
grant all on public.cleaner_time_off to service_role;
