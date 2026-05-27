-- NF-7C: Team assignment schema foundation (read-model prep only).
-- booking_cleaners is future-ready roster storage; bookings.cleaner_id remains dispatch authority.
-- Does not modify assignment offers, payout, completion, or lifecycle commands.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'booking_cleaner_role'
  ) then
    create type public.booking_cleaner_role as enum ('primary', 'support');
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'booking_cleaner_status'
  ) then
    create type public.booking_cleaner_status as enum (
      'planned',
      'offered',
      'accepted',
      'declined',
      'removed',
      'completed'
    );
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- booking_cleaners
-- ---------------------------------------------------------------------------

create table if not exists public.booking_cleaners (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  cleaner_id uuid not null references public.cleaners (id) on delete restrict,
  role public.booking_cleaner_role not null,
  status public.booking_cleaner_status not null default 'planned',
  assigned_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_cleaners_booking_cleaner_unique unique (booking_id, cleaner_id)
);
comment on table public.booking_cleaners is
  'NF-7C: Future multi-cleaner roster per booking. Not active dispatch — bookings.cleaner_id remains assignment authority until NF-7D.';
comment on column public.booking_cleaners.role is
  'primary = lead cleaner slot; support = additional cleaner slot.';
comment on column public.booking_cleaners.status is
  'Roster participation lifecycle (planned → offered → accepted/declined → completed/removed). Independent of assignment_offers until NF-7D.';
comment on column public.booking_cleaners.assigned_by_profile_id is
  'Admin profile that recorded the roster row (nullable for system/backfill).';
create index if not exists idx_booking_cleaners_booking_id
  on public.booking_cleaners (booking_id);
create index if not exists idx_booking_cleaners_cleaner_id
  on public.booking_cleaners (cleaner_id);
-- At most one active primary per booking (removed/declined primaries may be replaced later).
create unique index if not exists idx_booking_cleaners_one_active_primary
  on public.booking_cleaners (booking_id)
  where role = 'primary'
    and status not in ('removed', 'declined');
-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.booking_cleaners enable row level security;
drop policy if exists booking_cleaners_select_cleaner on public.booking_cleaners;
create policy booking_cleaners_select_cleaner on public.booking_cleaners
  for select to authenticated
  using (cleaner_id = public.auth_cleaner_id());
drop policy if exists booking_cleaners_select_admin on public.booking_cleaners;
create policy booking_cleaners_select_admin on public.booking_cleaners
  for select to authenticated
  using (public.auth_is_admin());
drop policy if exists booking_cleaners_admin_write on public.booking_cleaners;
create policy booking_cleaners_admin_write on public.booking_cleaners
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
comment on table public.booking_cleaners is
  'NF-7C: Future multi-cleaner roster. Admin: read/write. Cleaner: read own rows only. No customer policy. bookings.cleaner_id remains dispatch authority (NF-7D).';
