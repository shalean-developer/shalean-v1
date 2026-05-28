-- Ensure cleaner booking visibility follows selected cleaner assignments.

create or replace function public.cleaner_can_access_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.id = p_booking_id
      and (
        exists (
          select 1
          from public.cleaners selected_cleaner
          where selected_cleaner.id = b.selected_cleaner_id
            and selected_cleaner.auth_user_id = auth.uid()
        )
        or exists (
          select 1
          from public.booking_cleaners bc
          join public.cleaners assigned_cleaner
            on assigned_cleaner.id = bc.cleaner_id
          where bc.booking_id = b.id
            and assigned_cleaner.auth_user_id = auth.uid()
            and bc.status in ('pending_payment', 'offered', 'accepted', 'in_progress', 'completed')
        )
      )
  );
$$;

alter table public.bookings enable row level security;
alter table public.booking_cleaners enable row level security;

drop policy if exists bookings_select_cleaner on public.bookings;
create policy bookings_select_cleaner on public.bookings
  for select to authenticated
  using (public.cleaner_can_access_booking(id));

drop policy if exists booking_cleaners_select_cleaner on public.booking_cleaners;
create policy booking_cleaners_select_cleaner on public.booking_cleaners
  for select to authenticated
  using (
    exists (
      select 1
      from public.cleaners c
      where c.id = booking_cleaners.cleaner_id
        and c.auth_user_id = auth.uid()
    )
  );

insert into public.booking_cleaners (
  booking_id,
  cleaner_id,
  cleaner_count,
  is_preferred,
  status,
  offered_at,
  accepted_at,
  earning_cents,
  eligible_value_cents,
  earning_rate_percent,
  earning_rule
)
select
  b.id as booking_id,
  b.selected_cleaner_id as cleaner_id,
  b.cleaner_count,
  true as is_preferred,
  'accepted' as status,
  now() as offered_at,
  now() as accepted_at,
  case
    when c.tenure_months >= 4 then least(30000, greatest(25000, round(((b.bedrooms * 7000) + (b.bathrooms * 8500) + (b.extra_rooms * 6500) + b.addons_total_cents) * 0.70)))
    else least(30000, greatest(25000, round(((b.bedrooms * 7000) + (b.bathrooms * 8500) + (b.extra_rooms * 6500) + b.addons_total_cents) * 0.60)))
  end::integer as earning_cents,
  ((b.bedrooms * 7000) + (b.bathrooms * 8500) + (b.extra_rooms * 6500) + b.addons_total_cents)::integer as eligible_value_cents,
  case when c.tenure_months >= 4 then 70 else 60 end as earning_rate_percent,
  case
    when c.tenure_months >= 4 then 'Regular Cleaning 70% tenure rule, capped R250-R300'
    else 'Regular Cleaning 60% starter rule, capped R250-R300'
  end as earning_rule
from public.bookings b
join public.cleaners c on c.id = b.selected_cleaner_id
left join public.booking_cleaners bc
  on bc.booking_id = b.id
 and bc.cleaner_id = b.selected_cleaner_id
where b.selected_cleaner_id is not null
  and b.payment_status = 'paid'
  and b.booking_status in ('confirmed', 'assigned', 'in_progress', 'completed')
  and bc.id is null;

update public.booking_cleaners bc
set
  status = 'accepted',
  offered_at = coalesce(bc.offered_at, now()),
  accepted_at = coalesce(bc.accepted_at, now()),
  declined_at = null,
  decline_reason = null,
  earning_cents = coalesce(
    bc.earning_cents,
    case
      when c.tenure_months >= 4 then least(30000, greatest(25000, round(((b.bedrooms * 7000) + (b.bathrooms * 8500) + (b.extra_rooms * 6500) + b.addons_total_cents) * 0.70)))
      else least(30000, greatest(25000, round(((b.bedrooms * 7000) + (b.bathrooms * 8500) + (b.extra_rooms * 6500) + b.addons_total_cents) * 0.60)))
    end::integer
  ),
  eligible_value_cents = coalesce(
    bc.eligible_value_cents,
    ((b.bedrooms * 7000) + (b.bathrooms * 8500) + (b.extra_rooms * 6500) + b.addons_total_cents)::integer
  ),
  earning_rate_percent = coalesce(bc.earning_rate_percent, case when c.tenure_months >= 4 then 70 else 60 end),
  earning_rule = coalesce(
    bc.earning_rule,
    case
      when c.tenure_months >= 4 then 'Regular Cleaning 70% tenure rule, capped R250-R300'
      else 'Regular Cleaning 60% starter rule, capped R250-R300'
    end
  )
from public.bookings b
join public.cleaners c on c.id = b.selected_cleaner_id
where bc.booking_id = b.id
  and bc.cleaner_id = b.selected_cleaner_id
  and bc.status in ('pending_payment', 'offered')
  and b.payment_status = 'paid'
  and b.booking_status in ('confirmed', 'assigned', 'in_progress', 'completed');

update public.bookings b
set
  booking_status = 'assigned',
  updated_at = now()
where b.payment_status = 'paid'
  and b.booking_status = 'confirmed'
  and b.selected_cleaner_id is not null
  and exists (
    select 1
    from public.booking_cleaners bc
    where bc.booking_id = b.id
      and bc.cleaner_id = b.selected_cleaner_id
      and bc.status in ('accepted', 'in_progress', 'completed')
  );
