-- Booking command execution layer: richer audit fields, idempotency, and
-- atomic transition helpers (service_role only — tighten grants before production).

-- ---------------------------------------------------------------------------
-- booking_state_audit: structured fields (metadata still mirrored into payload)
-- ---------------------------------------------------------------------------

alter table public.booking_state_audit
  add column if not exists actor_type text not null default 'system',
  add column if not exists reason text,
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
comment on column public.booking_state_audit.actor_type is
  'Who initiated the command: customer | cleaner | admin | system | service';
comment on column public.booking_state_audit.idempotency_key is
  'Optional dedupe key (e.g. payment webhook id). Unique per booking when set.';
create unique index if not exists booking_state_audit_booking_idempotency_unique
  on public.booking_state_audit (booking_id, idempotency_key)
  where idempotency_key is not null;
-- ---------------------------------------------------------------------------
-- Atomic status transition + audit (optimistic concurrency on from_status)
-- ---------------------------------------------------------------------------

create or replace function public.booking_apply_transition(
  p_booking_id uuid,
  p_expected_from public.booking_status,
  p_to public.booking_status,
  p_command text,
  p_actor_profile_id uuid,
  p_actor_type text,
  p_reason text,
  p_idempotency_key text,
  p_metadata jsonb,
  p_cleaner_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.bookings%rowtype;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if p_idempotency_key is not null then
    select b.* into v_row
    from public.bookings b
    where b.id = p_booking_id
    for update;

    if not found then
      raise exception 'BOOKING_NOT_FOUND';
    end if;

    if exists (
      select 1
      from public.booking_state_audit a
      where a.booking_id = p_booking_id
        and a.idempotency_key = p_idempotency_key
    ) then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'booking_id', v_row.id,
        'status', v_row.status
      );
    end if;
  else
    select * into v_row from public.bookings where id = p_booking_id for update;
    if not found then
      raise exception 'BOOKING_NOT_FOUND';
    end if;
  end if;

  if v_row.status is distinct from p_expected_from then
    raise exception 'BOOKING_STATUS_CONFLICT:%', v_row.status;
  end if;

  update public.bookings
  set
    status = p_to,
    cleaner_id = coalesce(p_cleaner_id, cleaner_id),
    updated_at = now()
  where id = p_booking_id
    and status = p_expected_from;

  if not found then
    raise exception 'BOOKING_UPDATE_LOST_RACE';
  end if;

  insert into public.booking_state_audit (
    booking_id,
    from_status,
    to_status,
    command,
    actor_profile_id,
    payload,
    actor_type,
    reason,
    idempotency_key,
    metadata
  ) values (
    p_booking_id,
    p_expected_from,
    p_to,
    p_command,
    p_actor_profile_id,
    v_meta,
    coalesce(p_actor_type, 'system'),
    p_reason,
    p_idempotency_key,
    v_meta
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'booking_id', p_booking_id,
    'status', p_to
  );
end;
$$;
comment on function public.booking_apply_transition is
  'Updates bookings.status from an expected value and appends booking_state_audit in one transaction.';
-- ---------------------------------------------------------------------------
-- Payment success: payment row + booking + audit (idempotent via audit key)
-- ---------------------------------------------------------------------------

create or replace function public.booking_finalize_payment_success(
  p_booking_id uuid,
  p_payment_id uuid,
  p_idempotency_key text,
  p_command text,
  p_actor_profile_id uuid,
  p_actor_type text,
  p_reason text,
  p_metadata jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_pay_rows int;
begin
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select b.* into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.booking_state_audit a
    where a.booking_id = p_booking_id and a.idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'booking_id', v_booking.id,
      'status', v_booking.status
    );
  end if;

  if v_booking.status is distinct from 'pending_payment' then
    raise exception 'BOOKING_NOT_AWAITING_PAYMENT:%', v_booking.status;
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.booking_id is distinct from p_booking_id then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  update public.payments
  set status = 'paid', updated_at = now()
  where id = p_payment_id
    and booking_id = p_booking_id
    and status in ('initialized', 'pending');

  get diagnostics v_pay_rows = row_count;
  if v_pay_rows = 0 then
    raise exception 'PAYMENT_NOT_FINALIZABLE';
  end if;

  update public.bookings
  set status = 'confirmed', updated_at = now()
  where id = p_booking_id and status = 'pending_payment';

  insert into public.booking_state_audit (
    booking_id, from_status, to_status, command, actor_profile_id, payload,
    actor_type, reason, idempotency_key, metadata
  ) values (
    p_booking_id, 'pending_payment', 'confirmed', p_command, p_actor_profile_id,
    v_meta, coalesce(p_actor_type, 'system'), p_reason, p_idempotency_key, v_meta
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'booking_id', p_booking_id,
    'status', 'confirmed'
  );
end;
$$;
-- ---------------------------------------------------------------------------
-- Payment failure: mark payment failed + booking payment_failed
-- ---------------------------------------------------------------------------

create or replace function public.booking_record_payment_failure(
  p_booking_id uuid,
  p_payment_id uuid,
  p_idempotency_key text,
  p_command text,
  p_actor_profile_id uuid,
  p_actor_type text,
  p_reason text,
  p_metadata jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.booking_state_audit a
    where a.booking_id = p_booking_id and a.idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'booking_id', v_booking.id,
      'status', v_booking.status
    );
  end if;

  if v_booking.status is distinct from 'pending_payment' then
    raise exception 'BOOKING_NOT_AWAITING_PAYMENT:%', v_booking.status;
  end if;

  update public.payments
  set status = 'failed', updated_at = now()
  where id = p_payment_id
    and booking_id = p_booking_id
    and status in ('initialized', 'pending');

  update public.bookings
  set status = 'payment_failed', updated_at = now()
  where id = p_booking_id and status = 'pending_payment';

  insert into public.booking_state_audit (
    booking_id, from_status, to_status, command, actor_profile_id, payload,
    actor_type, reason, idempotency_key, metadata
  ) values (
    p_booking_id, 'pending_payment', 'payment_failed', p_command, p_actor_profile_id,
    v_meta, coalesce(p_actor_type, 'system'), p_reason, p_idempotency_key, v_meta
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'booking_id', p_booking_id,
    'status', 'payment_failed'
  );
end;
$$;
revoke all on function public.booking_apply_transition from public;
revoke all on function public.booking_finalize_payment_success from public;
revoke all on function public.booking_record_payment_failure from public;
grant execute on function public.booking_apply_transition to service_role;
grant execute on function public.booking_finalize_payment_success to service_role;
grant execute on function public.booking_record_payment_failure to service_role;
