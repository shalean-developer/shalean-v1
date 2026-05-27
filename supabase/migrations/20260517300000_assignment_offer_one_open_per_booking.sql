-- Stage 3C-a: at most one open (offered) assignment offer per booking (single-cleaner dispatch).

-- ---------------------------------------------------------------------------
-- Backfill: cancel duplicate open offers, keep newest per booking (no deletes)
-- ---------------------------------------------------------------------------

with ranked as (
  select
    id,
    row_number() over (
      partition by booking_id
      order by offered_at desc nulls last, created_at desc, id desc
    ) as rn
  from public.assignment_offers
  where status = 'offered'
)
update public.assignment_offers ao
set
  status = 'cancelled',
  responded_at = coalesce(ao.responded_at, now()),
  updated_at = now()
from ranked r
where ao.id = r.id
  and r.rn > 1;
-- ---------------------------------------------------------------------------
-- Enforce one open offer per booking (coexists with per-cleaner partial unique)
-- ---------------------------------------------------------------------------

create unique index if not exists idx_assignment_offers_one_open_per_booking
  on public.assignment_offers (booking_id)
  where status = 'offered';
comment on index public.idx_assignment_offers_one_open_per_booking is
  'Stage 3C-a: single-cleaner dispatch — at most one offered row per booking. Team assignment may replace with slot-based uniqueness later.';
