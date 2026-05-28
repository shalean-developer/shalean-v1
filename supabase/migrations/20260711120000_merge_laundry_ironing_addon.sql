-- Merge the separate "ironing" and "laundry" regular-cleaning add-ons into a
-- single combined "Laundry & Ironing" add-on offered going forward.
--
-- Historical booking_addons rows are intentionally left untouched: they store
-- their own label/price_cents snapshot (no FK to service_addons), so retiring
-- the catalog rows does not affect past bookings, and we preserve them exactly
-- as they were sold.

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

-- 2. Retire the old catalog add-ons so the wizard no longer offers them.
delete from public.service_addons
where service_slug = 'regular-cleaning'
  and key in ('ironing', 'laundry');
