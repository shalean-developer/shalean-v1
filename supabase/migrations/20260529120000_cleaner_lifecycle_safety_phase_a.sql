-- Cleaner lifecycle safety Phase A:
-- Remove admin hard-delete path; protect operational/financial truth with FK RESTRICT.
-- No lifecycle columns, RPCs, or assignment logic changes.

-- ---------------------------------------------------------------------------
-- 1) Drop dangerous RLS delete policy
-- ---------------------------------------------------------------------------

drop policy if exists cleaners_admin_delete on public.cleaners;
-- Belt-and-suspenders: table-level DELETE must not be available to JWT clients.
revoke delete on public.cleaners from authenticated;
-- ---------------------------------------------------------------------------
-- 2) Replace cleaner FK delete actions (CASCADE / SET NULL → RESTRICT where safe)
-- ---------------------------------------------------------------------------

alter table public.assignment_offers
  drop constraint if exists assignment_offers_cleaner_id_fkey;
alter table public.assignment_offers
  add constraint assignment_offers_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete restrict;
alter table public.earning_lines
  drop constraint if exists earning_lines_cleaner_id_fkey;
alter table public.earning_lines
  add constraint earning_lines_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete restrict;
alter table public.bookings
  drop constraint if exists bookings_cleaner_id_fkey;
alter table public.bookings
  add constraint bookings_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete restrict;
alter table public.cleaner_service_areas
  drop constraint if exists cleaner_service_areas_cleaner_id_fkey;
alter table public.cleaner_service_areas
  add constraint cleaner_service_areas_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete restrict;
alter table public.cleaner_service_capabilities
  drop constraint if exists cleaner_service_capabilities_cleaner_id_fkey;
alter table public.cleaner_service_capabilities
  add constraint cleaner_service_capabilities_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete restrict;
alter table public.cleaner_availability
  drop constraint if exists cleaner_availability_cleaner_id_fkey;
alter table public.cleaner_availability
  add constraint cleaner_availability_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete restrict;
alter table public.cleaner_time_off
  drop constraint if exists cleaner_time_off_cleaner_id_fkey;
alter table public.cleaner_time_off
  add constraint cleaner_time_off_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete restrict;
-- booking_cleaners.cleaner_id already ON DELETE RESTRICT (NF-7C).
-- admin_operational_audit.cleaner_id remains ON DELETE SET NULL (audit/history-safe).

comment on table public.cleaners is
  'Cleaner identity row. Hard DELETE is blocked for authenticated roles (Phase A). Operational children use ON DELETE RESTRICT.';
