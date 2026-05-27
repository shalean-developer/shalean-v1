-- Operational reset: allow parent DELETE to orphan append-only audit FKs (SET NULL only).
-- Audit rows are never DELETE'd. Triggers still forbid arbitrary UPDATE/DELETE.

create or replace function public.forbid_booking_state_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.booking_id is not null and new.booking_id is null)
       or (old.actor_profile_id is not null and new.actor_profile_id is null)
    then
      if new.to_status is not distinct from old.to_status
         and new.from_status is not distinct from old.from_status
         and new.command is not distinct from old.command
         and new.payload is not distinct from old.payload
         and new.idempotency_key is not distinct from old.idempotency_key
         and new.created_at is not distinct from old.created_at
      then
        return new;
      end if;
    end if;
  end if;

  raise exception 'booking_state_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
create or replace function public.forbid_admin_operational_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.booking_id is not null and new.booking_id is null)
       or (old.cleaner_id is not null and new.cleaner_id is null)
       or (old.offer_id is not null and new.offer_id is null)
       or (old.cancelled_offer_id is not null and new.cancelled_offer_id is null)
       or (old.admin_profile_id is not null and new.admin_profile_id is null)
    then
      if new.action is not distinct from old.action
         and new.outcome is not distinct from old.outcome
         and new.reason is not distinct from old.reason
         and new.result_code is not distinct from old.result_code
         and new.idempotency_key is not distinct from old.idempotency_key
         and new.booking_status_before is not distinct from old.booking_status_before
         and new.booking_status_after is not distinct from old.booking_status_after
         and new.metadata is not distinct from old.metadata
         and new.created_at is not distinct from old.created_at
      then
        return new;
      end if;
    end if;
  end if;

  raise exception 'admin_operational_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
create or replace function public.forbid_customer_operational_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.customer_id is not null and new.customer_id is null)
       or (old.admin_profile_id is not null and new.admin_profile_id is null)
    then
      if new.action is not distinct from old.action
         and new.outcome is not distinct from old.outcome
         and new.reason is not distinct from old.reason
         and new.metadata is not distinct from old.metadata
         and new.idempotency_key is not distinct from old.idempotency_key
         and new.created_at is not distinct from old.created_at
      then
        return new;
      end if;
    end if;
  end if;

  raise exception 'customer_operational_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
create or replace function public.forbid_cleaner_operational_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.cleaner_id is not null and new.cleaner_id is null)
       or (old.admin_profile_id is not null and new.admin_profile_id is null)
    then
      if new.action is not distinct from old.action
         and new.outcome is not distinct from old.outcome
         and new.reason is not distinct from old.reason
         and new.before_state is not distinct from old.before_state
         and new.after_state is not distinct from old.after_state
         and new.affected_counts is not distinct from old.affected_counts
         and new.metadata is not distinct from old.metadata
         and new.idempotency_key is not distinct from old.idempotency_key
         and new.created_at is not distinct from old.created_at
      then
        return new;
      end if;
    end if;
  end if;

  raise exception 'cleaner_operational_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
-- booking_state_audit: CASCADE delete → SET NULL orphan (row preserved)
alter table public.booking_state_audit
  alter column booking_id drop not null;
alter table public.booking_state_audit
  drop constraint if exists booking_state_audit_booking_id_fkey;
alter table public.booking_state_audit
  add constraint booking_state_audit_booking_id_fkey
  foreign key (booking_id) references public.bookings (id) on delete set null;
-- admin_operational_audit: preserve rows when booking/cleaner/offer parents removed
alter table public.admin_operational_audit
  alter column booking_id drop not null;
alter table public.admin_operational_audit
  drop constraint if exists admin_operational_audit_booking_id_fkey;
alter table public.admin_operational_audit
  add constraint admin_operational_audit_booking_id_fkey
  foreign key (booking_id) references public.bookings (id) on delete set null;
alter table public.admin_operational_audit
  drop constraint if exists admin_operational_audit_cleaner_id_fkey;
alter table public.admin_operational_audit
  add constraint admin_operational_audit_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete set null;
alter table public.admin_operational_audit
  drop constraint if exists admin_operational_audit_offer_id_fkey;
alter table public.admin_operational_audit
  add constraint admin_operational_audit_offer_id_fkey
  foreign key (offer_id) references public.assignment_offers (id) on delete set null;
alter table public.admin_operational_audit
  drop constraint if exists admin_operational_audit_cancelled_offer_id_fkey;
alter table public.admin_operational_audit
  add constraint admin_operational_audit_cancelled_offer_id_fkey
  foreign key (cancelled_offer_id) references public.assignment_offers (id) on delete set null;
-- customer_operational_audit: preserve rows when customer removed
alter table public.customer_operational_audit
  alter column customer_id drop not null;
alter table public.customer_operational_audit
  drop constraint if exists customer_operational_audit_customer_id_fkey;
alter table public.customer_operational_audit
  add constraint customer_operational_audit_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete set null;
-- cleaner_operational_audit: preserve rows when cleaner removed
alter table public.cleaner_operational_audit
  alter column cleaner_id drop not null;
alter table public.cleaner_operational_audit
  drop constraint if exists cleaner_operational_audit_cleaner_id_fkey;
alter table public.cleaner_operational_audit
  add constraint cleaner_operational_audit_cleaner_id_fkey
  foreign key (cleaner_id) references public.cleaners (id) on delete set null;
comment on function public.forbid_booking_state_audit_mutation is
  'Append-only guard. Allows FK-driven SET NULL on booking_id/actor_profile_id for operational reset only.';
