-- Admin cleaner management runs through the server-side service role client.
-- A later hardening migration left public.cleaners with SELECT-only access for
-- service_role, causing 42501 errors when admins created or updated cleaners.

grant select, insert, update on table public.cleaners to service_role;
