-- Phase 1: align payment_status enum with values written by admin manual payment logic.

do $$
begin
  if exists (select 1 from pg_type where typname = 'v1_payment_status')
    and not exists (
      select 1
      from pg_enum e
      join pg_type t on e.enumtypid = t.oid
      where t.typname = 'v1_payment_status'
        and e.enumlabel = 'partially_paid'
    )
  then
    alter type public.v1_payment_status add value 'partially_paid' after 'paid';
  end if;
end
$$;

comment on type public.v1_payment_status is
  'Booking/payment lifecycle: pending, initialized, paid, partially_paid (legacy partial path), failed, refunded.';
