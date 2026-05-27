-- NF-7D: Slot-aware team offers and booking_cleaners roster sync.
-- Relaxes one-open-offer-per-booking to one open offer per booking per team_role slot.
-- Does not change payout, completion, or booking lifecycle commands.

-- ---------------------------------------------------------------------------
-- assignment_offers: slot identity
-- ---------------------------------------------------------------------------

alter table public.assignment_offers
  add column if not exists team_role public.booking_cleaner_role not null default 'primary';
alter table public.assignment_offers
  add column if not exists roster_id uuid references public.booking_cleaners (id) on delete set null;
comment on column public.assignment_offers.team_role is
  'NF-7D: Offer slot — primary (legacy dispatch) or support (team add-on). One open offer per booking per team_role.';
comment on column public.assignment_offers.roster_id is
  'NF-7D: Linked booking_cleaners row when roster sync is active.';
create index if not exists idx_assignment_offers_roster_id
  on public.assignment_offers (roster_id)
  where roster_id is not null;
-- ---------------------------------------------------------------------------
-- Uniqueness: one open offer per booking per team_role (replaces booking-only index)
-- ---------------------------------------------------------------------------

drop index if exists public.idx_assignment_offers_one_open_per_booking;
create unique index if not exists idx_assignment_offers_one_open_per_booking_team_role
  on public.assignment_offers (booking_id, team_role)
  where status = 'offered';
comment on index public.idx_assignment_offers_one_open_per_booking_team_role is
  'NF-7D: at most one offered row per booking per slot (primary | support). Legacy single-cleaner = primary only.';
-- ---------------------------------------------------------------------------
-- Cleaner booking access: roster members with offered or accepted status
-- ---------------------------------------------------------------------------

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
        b.cleaner_id = public.auth_cleaner_id()
        or exists (
          select 1
          from public.assignment_offers ao
          where ao.booking_id = b.id
            and ao.cleaner_id = public.auth_cleaner_id()
        )
        or exists (
          select 1
          from public.booking_cleaners bc
          where bc.booking_id = b.id
            and bc.cleaner_id = public.auth_cleaner_id()
            and bc.status in ('offered', 'accepted')
        )
      )
  );
$$;
