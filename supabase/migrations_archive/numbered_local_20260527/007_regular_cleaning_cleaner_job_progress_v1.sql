do $$
begin
  if exists (select 1 from pg_type where typname = 'v1_booking_status')
    and not exists (
      select 1
      from pg_enum
      where enumtypid = 'public.v1_booking_status'::regtype
        and enumlabel = 'in_progress'
    ) then
    alter type public.v1_booking_status add value 'in_progress' after 'assigned';
  end if;
end $$;

alter table public.booking_cleaners
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

drop index if exists public.booking_cleaners_active_offer_unique_idx;

create unique index if not exists booking_cleaners_active_offer_unique_idx
  on public.booking_cleaners(booking_id, cleaner_id)
  where cleaner_id is not null
    and status in ('pending_payment', 'offered', 'accepted', 'in_progress');
