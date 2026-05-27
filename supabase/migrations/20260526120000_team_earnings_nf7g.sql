-- NF-7G: Multi-cleaner earning line foundation (additive, reconciliation-first).
-- Does not change booking lifecycle, payments, or bookings.cleaner_id authority.

-- ---------------------------------------------------------------------------
-- earning_lines: team role / source columns (nullable for historical rows)
-- ---------------------------------------------------------------------------

alter table public.earning_lines
  add column if not exists team_earning_role text,
  add column if not exists team_earning_source text;
comment on column public.earning_lines.team_earning_role is
  'NF-7G: primary | support — null on pre-NF-7G rows.';
comment on column public.earning_lines.team_earning_source is
  'NF-7G: team_split | manual_adjustment | legacy_primary — null on pre-NF-7G rows.';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'earning_lines_team_earning_role_check'
  ) then
    alter table public.earning_lines
      add constraint earning_lines_team_earning_role_check
      check (
        team_earning_role is null
        or team_earning_role in ('primary', 'support')
      );
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'earning_lines_team_earning_source_check'
  ) then
    alter table public.earning_lines
      add constraint earning_lines_team_earning_source_check
      check (
        team_earning_source is null
        or team_earning_source in ('team_split', 'manual_adjustment', 'legacy_primary')
      );
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- Uniqueness: one completion line per cleaner per booking (safe migration)
-- Replaces booking_id+line_type singleton for booking_completion only.
-- ---------------------------------------------------------------------------

drop index if exists public.earning_lines_booking_completion_unique;
create unique index if not exists earning_lines_booking_cleaner_completion_unique
  on public.earning_lines (booking_id, cleaner_id)
  where booking_id is not null
    and line_type in ('booking_completion', 'team_support_completion');
create index if not exists idx_earning_lines_team_support_completion
  on public.earning_lines (booking_id, line_type)
  where line_type = 'team_support_completion';
comment on index public.earning_lines_booking_cleaner_completion_unique is
  'NF-7G: Prevents duplicate payout lines per cleaner per booking for completion types.';
