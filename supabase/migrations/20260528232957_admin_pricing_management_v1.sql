-- Admin-managed pricing catalog for booking quotes.
-- Customer-visible reads are limited to active rows; writes are admin/service-role only.

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  key text not null,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_slug, key)
);

create table if not exists public.recurring_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  key text not null,
  name text not null,
  description text,
  multiplier numeric(8, 4) not null default 1 check (multiplier >= 0),
  prepaid_visits integer not null default 1 check (prepaid_visits >= 1),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_slug, key)
);

create or replace function public.set_pricing_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_set_pricing_updated_at on public.services;
create trigger services_set_pricing_updated_at
  before update on public.services
  for each row
  execute function public.set_pricing_updated_at();

drop trigger if exists service_addons_set_pricing_updated_at on public.service_addons;
create trigger service_addons_set_pricing_updated_at
  before update on public.service_addons
  for each row
  execute function public.set_pricing_updated_at();

drop trigger if exists service_equipment_options_set_pricing_updated_at on public.service_equipment_options;
create trigger service_equipment_options_set_pricing_updated_at
  before update on public.service_equipment_options
  for each row
  execute function public.set_pricing_updated_at();

drop trigger if exists cleaner_quantity_rules_set_pricing_updated_at on public.cleaner_quantity_rules;
create trigger cleaner_quantity_rules_set_pricing_updated_at
  before update on public.cleaner_quantity_rules
  for each row
  execute function public.set_pricing_updated_at();

drop trigger if exists pricing_rules_set_updated_at on public.pricing_rules;
create trigger pricing_rules_set_updated_at
  before update on public.pricing_rules
  for each row
  execute function public.set_pricing_updated_at();

drop trigger if exists recurring_pricing_rules_set_updated_at on public.recurring_pricing_rules;
create trigger recurring_pricing_rules_set_updated_at
  before update on public.recurring_pricing_rules
  for each row
  execute function public.set_pricing_updated_at();

alter table public.services
  alter column base_price_cents set default 0,
  add constraint services_base_price_cents_nonnegative check (base_price_cents >= 0) not valid;

do $$
begin
  begin
    alter table public.services validate constraint services_base_price_cents_nonnegative;
  exception
    when check_violation then
      update public.services set base_price_cents = 0 where base_price_cents < 0;
      alter table public.services validate constraint services_base_price_cents_nonnegative;
  end;
end $$;

insert into public.services
  (slug, title, name, category, description, default_duration_minutes, base_price_cents, currency, active, min_hours, requires_team)
values
  ('regular-cleaning', 'Regular Cleaning', 'Regular Cleaning', 'regular', 'Recurring or once-off home cleaning with premium add-ons, equipment choice, and cleaner selection.', 180, 30000, 'ZAR', true, 3, false)
on conflict (slug) where slug is not null do update set
  title = excluded.title,
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  base_price_cents = case
    when public.services.base_price_cents <= 0 then excluded.base_price_cents
    else public.services.base_price_cents
  end,
  currency = 'ZAR',
  active = true,
  min_hours = excluded.min_hours,
  requires_team = excluded.requires_team,
  updated_at = now();

insert into public.pricing_rules
  (service_slug, key, name, description, price_cents, estimated_minutes, active, sort_order)
values
  ('regular-cleaning', 'bedroom', 'Price per bedroom', 'Room allocation added for each bedroom.', 7000, 35, true, 10),
  ('regular-cleaning', 'bathroom', 'Price per bathroom', 'Room allocation added for each bathroom.', 8500, 45, true, 20),
  ('regular-cleaning', 'extra_room', 'Price per extra room', 'Room allocation added for study, lounge, or other extra rooms.', 6500, 25, true, 30),
  ('regular-cleaning', 'minimum_booking', 'Minimum booking price', 'Minimum customer-facing total before recurring/prepaid discounts.', 35000, 0, true, 40),
  ('regular-cleaning', 'large_property_25sqm', 'Large property adjustment', 'Additional price per 25sqm above 120sqm.', 5500, 10, true, 50)
on conflict (service_slug, key) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  estimated_minutes = excluded.estimated_minutes,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.recurring_pricing_rules
  (service_slug, key, name, description, multiplier, prepaid_visits, active, sort_order)
values
  ('regular-cleaning', 'once', 'Once-off', 'Single visit with no prepaid discount.', 1.0000, 1, true, 10),
  ('regular-cleaning', 'weekly', 'Weekly prepaid', 'Weekly recurring prepaid package.', 0.9000, 4, true, 20),
  ('regular-cleaning', 'fortnightly', 'Fortnightly prepaid', 'Fortnightly recurring prepaid package.', 0.9500, 4, true, 30),
  ('regular-cleaning', 'monthly', 'Monthly prepaid', 'Monthly recurring prepaid package.', 1.0000, 2, true, 40)
on conflict (service_slug, key) do update set
  name = excluded.name,
  description = excluded.description,
  multiplier = excluded.multiplier,
  prepaid_visits = excluded.prepaid_visits,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.pricing_rules enable row level security;
alter table public.recurring_pricing_rules enable row level security;

drop policy if exists pricing_rules_select_active on public.pricing_rules;
create policy pricing_rules_select_active on public.pricing_rules
  for select to anon, authenticated
  using (active = true or public.auth_is_admin());

drop policy if exists pricing_rules_admin_write on public.pricing_rules;
create policy pricing_rules_admin_write on public.pricing_rules
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

drop policy if exists recurring_pricing_rules_select_active on public.recurring_pricing_rules;
create policy recurring_pricing_rules_select_active on public.recurring_pricing_rules
  for select to anon, authenticated
  using (active = true or public.auth_is_admin());

drop policy if exists recurring_pricing_rules_admin_write on public.recurring_pricing_rules;
create policy recurring_pricing_rules_admin_write on public.recurring_pricing_rules
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

drop policy if exists service_addons_admin_write on public.service_addons;
create policy service_addons_admin_write on public.service_addons
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

drop policy if exists service_equipment_options_admin_write on public.service_equipment_options;
create policy service_equipment_options_admin_write on public.service_equipment_options
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

drop policy if exists cleaner_quantity_rules_admin_write on public.cleaner_quantity_rules;
create policy cleaner_quantity_rules_admin_write on public.cleaner_quantity_rules
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

grant select on public.services to anon, authenticated, service_role;
grant select on public.service_addons to anon, authenticated, service_role;
grant select on public.service_equipment_options to anon, authenticated, service_role;
grant select on public.cleaner_quantity_rules to anon, authenticated, service_role;
grant select on public.pricing_rules to anon, authenticated, service_role;
grant select on public.recurring_pricing_rules to anon, authenticated, service_role;
grant insert, update on public.services to authenticated, service_role;
grant insert, update on public.service_addons to authenticated, service_role;
grant insert, update on public.service_equipment_options to authenticated, service_role;
grant insert, update on public.cleaner_quantity_rules to authenticated, service_role;
grant insert, update on public.pricing_rules to authenticated, service_role;
grant insert, update on public.recurring_pricing_rules to authenticated, service_role;
