-- Phase 10: completion lifecycle, earnings ledger fields, payout batches, RLS.

-- ---------------------------------------------------------------------------
-- booking_status: payout_ready, paid_out
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'booking_status'
      and e.enumlabel = 'payout_ready'
  ) then
    alter type public.booking_status add value 'payout_ready';
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'booking_status'
      and e.enumlabel = 'paid_out'
  ) then
    alter type public.booking_status add value 'paid_out';
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- earning payout status enum
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'earning_payout_status'
  ) then
    create type public.earning_payout_status as enum ('pending', 'payout_ready', 'paid');
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- payout_batches (admin settlement batches — no bank transfer automation)
-- ---------------------------------------------------------------------------

create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  label text,
  status text not null default 'open',
  total_payout_cents bigint not null default 0,
  currency text not null default 'ZAR',
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz
);
comment on table public.payout_batches is
  'Admin grouping for marking earnings paid. No external transfer integration in Phase 10.';
-- ---------------------------------------------------------------------------
-- earning_lines extensions
-- ---------------------------------------------------------------------------

alter table public.earning_lines
  add column if not exists gross_amount_cents bigint,
  add column if not exists payout_amount_cents bigint,
  add column if not exists payout_status public.earning_payout_status not null default 'pending',
  add column if not exists payout_batch_id uuid references public.payout_batches (id) on delete set null,
  add column if not exists calculation_metadata jsonb not null default '{}'::jsonb;
update public.earning_lines el
set payout_amount_cents = el.amount_cents
where el.payout_amount_cents is null;
update public.earning_lines el
set gross_amount_cents = b.price_cents
from public.bookings b
where el.booking_id = b.id
  and el.gross_amount_cents is null;
update public.earning_lines
set gross_amount_cents = amount_cents
where gross_amount_cents is null;
alter table public.earning_lines
  alter column payout_amount_cents set default 0;
update public.earning_lines
set payout_amount_cents = amount_cents
where payout_amount_cents is null;
alter table public.earning_lines
  alter column gross_amount_cents set not null,
  alter column payout_amount_cents set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'earning_lines_payout_positive'
  ) then
    alter table public.earning_lines
      add constraint earning_lines_payout_positive check (payout_amount_cents > 0);
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'earning_lines_gross_nonnegative'
  ) then
    alter table public.earning_lines
      add constraint earning_lines_gross_nonnegative check (gross_amount_cents >= 0);
  end if;
end $$;
create unique index if not exists earning_lines_booking_completion_unique
  on public.earning_lines (booking_id, line_type)
  where booking_id is not null and line_type = 'booking_completion';
create index if not exists idx_earning_lines_payout_status
  on public.earning_lines (payout_status, created_at desc);
create index if not exists idx_earning_lines_payout_batch
  on public.earning_lines (payout_batch_id)
  where payout_batch_id is not null;
-- ---------------------------------------------------------------------------
-- RLS: payout_batches (admin only)
-- ---------------------------------------------------------------------------

alter table public.payout_batches enable row level security;
drop policy if exists payout_batches_admin on public.payout_batches;
create policy payout_batches_admin on public.payout_batches
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
-- earning_lines: no customer access (cleaner + admin policies exist in phase 2 migration)

drop policy if exists earning_lines_select_customer on public.earning_lines;
