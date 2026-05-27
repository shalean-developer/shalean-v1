-- NF-7F: Team completion participation (roster-only).
-- Support cleaners mark booking_cleaners.status = completed without booking lifecycle commands.
-- Does not change payout, earnings, Paystack, pricing, or assignment dispatch.

alter table public.booking_cleaners
  add column if not exists support_completed_at timestamptz,
  add column if not exists support_note text;
comment on column public.booking_cleaners.support_completed_at is
  'NF-7F: When a support cleaner confirmed participation (roster-only; not booking completion).';
comment on column public.booking_cleaners.support_note is
  'NF-7F: Optional note from support cleaner when confirming participation.';
-- Support cleaners may complete their own accepted support row (status → completed only).
drop policy if exists booking_cleaners_support_complete_self on public.booking_cleaners;
create policy booking_cleaners_support_complete_self on public.booking_cleaners
  for update to authenticated
  using (
    cleaner_id = public.auth_cleaner_id()
    and role = 'support'
    and status in ('accepted', 'completed')
  )
  with check (
    cleaner_id = public.auth_cleaner_id()
    and role = 'support'
    and status = 'completed'
  );
comment on table public.booking_cleaners is
  'NF-7C/7F: Multi-cleaner roster. Support may self-complete participation (NF-7F). bookings.cleaner_id remains lifecycle authority.';
