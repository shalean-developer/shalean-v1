-- Merge the separate "ironing" and "laundry" regular-cleaning add-ons into a
-- single combined "Laundry & Ironing" add-on.

-- 1. Upsert the combined add-on catalog row.
insert into public.service_addons
  (service_slug, key, label, description, price_cents, duration_minutes, workload_weight, sort_order, active)
values
  (
    'regular-cleaning',
    'laundryIroning',
    'Laundry & Ironing',
    'Laundry load support for wash, hang, fold, or rotate, plus light household ironing.',
    9000,
    60,
    1.20,
    50,
    true
  )
on conflict (service_slug, key) do update set
  label = excluded.label,
  description = excluded.description,
  price_cents = excluded.price_cents,
  duration_minutes = excluded.duration_minutes,
  workload_weight = excluded.workload_weight,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

-- 2. Remap existing booking add-on selections from the old keys, avoiding
--    collisions with the unique (booking_id, addon_key) constraint.
update public.booking_addons as ba
set addon_key = 'laundryIroning'
where ba.addon_key in ('ironing', 'laundry')
  and not exists (
    select 1
    from public.booking_addons existing
    where existing.booking_id = ba.booking_id
      and existing.addon_key = 'laundryIroning'
  );

-- Remove any remaining legacy rows that could not be remapped (duplicates where
-- the combined key already exists for that booking).
delete from public.booking_addons
where addon_key in ('ironing', 'laundry');

-- 3. Retire the old catalog add-ons.
delete from public.service_addons
where service_slug = 'regular-cleaning'
  and key in ('ironing', 'laundry');
