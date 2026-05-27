grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.services,
  public.service_addons,
  public.service_equipment_options,
  public.cleaner_quantity_rules,
  public.regular_cleaning_pricing_rules,
  public.cleaners
to anon, authenticated, service_role;

grant all privileges on table
  public.customers,
  public.bookings,
  public.booking_addons,
  public.booking_equipment,
  public.booking_cleaners,
  public.payments
to service_role;;
