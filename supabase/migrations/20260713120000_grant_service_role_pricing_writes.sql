-- Admin pricing management ("Save pricing") runs server-side as service_role,
-- gated by requireAdmin(). On databases where the catalog tables predate the
-- repo migrations, service_role was granted SELECT only, so saving a service,
-- add-on, equipment option, or cleaner-quantity rule failed with
-- "permission denied for table services" (surfaced in the UI as
-- "Unable to save pricing.").
--
-- Grant the write privileges service_role needs. These statements are
-- idempotent and safe to re-run; on a cleanly migrated database the grants
-- already exist. Writes are intentionally NOT granted to anon/authenticated
-- (public.services has RLS disabled, so that would be unsafe).

grant insert, update, delete on public.services to service_role;
grant insert, update, delete on public.service_addons to service_role;
grant insert, update, delete on public.service_equipment_options to service_role;
grant insert, update, delete on public.cleaner_quantity_rules to service_role;
grant insert, update, delete on public.pricing_rules to service_role;
grant insert, update, delete on public.recurring_pricing_rules to service_role;
grant insert, update, delete on public.regular_cleaning_pricing_rules to service_role;
