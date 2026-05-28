-- Restore active Regular Cleaning pricing rules when they were accidentally deactivated or removed.
insert into public.regular_cleaning_pricing_rules
  (bedrooms, bathrooms, base_price_cents, estimated_minutes, active)
values
  (0, 1, 35000, 150, true),
  (1, 1, 42000, 180, true),
  (2, 1, 52000, 210, true),
  (2, 2, 62000, 240, true),
  (3, 1, 65000, 255, true),
  (3, 2, 75000, 285, true),
  (4, 2, 88000, 330, true),
  (5, 3, 110000, 390, true)
on conflict (bedrooms, bathrooms) do update set
  base_price_cents = excluded.base_price_cents,
  estimated_minutes = excluded.estimated_minutes,
  active = true,
  updated_at = now();
