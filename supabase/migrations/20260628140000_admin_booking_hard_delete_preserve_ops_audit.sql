-- Fix: do not DELETE append-only admin_operational_audit rows during hard delete.

create or replace function public.admin_hard_delete_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_booking_id is null then
    raise exception 'booking_id is required';
  end if;

  if not exists (select 1 from public.bookings where id = p_booking_id) then
    raise exception 'booking not found: %', p_booking_id;
  end if;

  delete from public.assignment_offers where booking_id = p_booking_id;
  delete from public.booking_cleaners where booking_id = p_booking_id;
  delete from public.booking_locks where booking_id = p_booking_id;
  delete from public.booking_support_requests where booking_id = p_booking_id;

  -- admin_operational_audit is append-only; booking delete SET NULLs booking_id (see ops_preserve migration).

  alter table public.booking_state_audit disable trigger booking_state_audit_append_only;
  delete from public.booking_state_audit where booking_id = p_booking_id;
  alter table public.booking_state_audit enable trigger booking_state_audit_append_only;

  delete from public.payments where booking_id = p_booking_id;
  delete from public.bookings where id = p_booking_id;
end;
$$;
comment on function public.admin_hard_delete_booking(uuid) is
  'Service-role only. Permanently removes a booking and non-financial dependents. Preserves append-only admin_operational_audit rows (booking_id nulled). Caller must enforce eligibility in application layer.';
