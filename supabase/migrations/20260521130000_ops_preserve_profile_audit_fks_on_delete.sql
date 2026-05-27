-- Auth/ops reset: preserve append-only audit rows when profiles are deleted.
-- FK-driven SET NULL only; triggers remain append-only (no row DELETE).

-- admin_operational_audit.admin_profile_id was ON DELETE RESTRICT (blocks profile delete).
alter table public.admin_operational_audit
  alter column admin_profile_id drop not null;
alter table public.admin_operational_audit
  drop constraint if exists admin_operational_audit_admin_profile_id_fkey;
alter table public.admin_operational_audit
  add constraint admin_operational_audit_admin_profile_id_fkey
  foreign key (admin_profile_id) references public.profiles (id) on delete set null;
-- customer_operational_audit / cleaner_operational_audit: admin_profile_id already SET NULL;
-- re-assert idempotently in case a fork diverged.
alter table public.customer_operational_audit
  drop constraint if exists customer_operational_audit_admin_profile_id_fkey;
alter table public.customer_operational_audit
  add constraint customer_operational_audit_admin_profile_id_fkey
  foreign key (admin_profile_id) references public.profiles (id) on delete set null;
alter table public.cleaner_operational_audit
  drop constraint if exists cleaner_operational_audit_admin_profile_id_fkey;
alter table public.cleaner_operational_audit
  add constraint cleaner_operational_audit_admin_profile_id_fkey
  foreign key (admin_profile_id) references public.profiles (id) on delete set null;
-- booking_state_audit.actor_profile_id: already ON DELETE SET NULL; re-assert idempotently.
alter table public.booking_state_audit
  drop constraint if exists booking_state_audit_actor_profile_id_fkey;
alter table public.booking_state_audit
  add constraint booking_state_audit_actor_profile_id_fkey
  foreign key (actor_profile_id) references public.profiles (id) on delete set null;
comment on column public.admin_operational_audit.admin_profile_id is
  'Admin who performed the action. NULL when profile was removed (audit row preserved).';
