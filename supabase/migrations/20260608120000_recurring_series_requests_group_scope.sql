-- Phase 6C: Group-scoped recurring change requests (support queue; no auto-execution).
-- Prerequisite: 20260606120000_recurring_schedule_groups.sql (Phase 6A) must be applied first.

do $$
begin
  if to_regclass('public.recurring_schedule_groups') is null then
    raise exception
      'Missing public.recurring_schedule_groups. Run supabase/migrations/20260606120000_recurring_schedule_groups.sql first, then re-run this migration.';
  end if;
  if to_regclass('public.recurring_series_requests') is null then
    raise exception
      'Missing public.recurring_series_requests. Run supabase/migrations/20260605120000_recurring_series_requests.sql first, then re-run this migration.';
  end if;
end $$;
alter table public.recurring_series_requests
  add column if not exists group_id uuid references public.recurring_schedule_groups (id) on delete set null,
  add column if not exists scope text not null default 'series'
    check (scope in ('series', 'group')),
  add column if not exists target_weekday smallint
    check (target_weekday is null or (target_weekday >= 0 and target_weekday <= 6));
comment on column public.recurring_series_requests.group_id is
  'Schedule group for group-scoped or weekday-scoped requests.';
comment on column public.recurring_series_requests.scope is
  'series = weekday-specific; group = entire multi-day schedule.';
comment on column public.recurring_series_requests.target_weekday is
  'Weekday (0=Sun..6=Sat) when scope=series and request targets one slot in a group.';
alter table public.recurring_series_requests
  alter column series_id drop not null;
alter table public.recurring_series_requests
  drop constraint if exists recurring_series_requests_request_type_check;
alter table public.recurring_series_requests
  add constraint recurring_series_requests_request_type_check
  check (
    request_type in (
      'pause',
      'cancel',
      'reschedule',
      'pause_group',
      'cancel_group',
      'reschedule_group',
      'pause_weekday',
      'cancel_weekday',
      'reschedule_weekday'
    )
  );
alter table public.recurring_series_requests
  drop constraint if exists recurring_series_requests_scope_target_check;
alter table public.recurring_series_requests
  add constraint recurring_series_requests_scope_target_check
  check (
    (scope = 'series' and series_id is not null)
    or (scope = 'group' and group_id is not null)
  );
create index if not exists idx_recurring_series_requests_group_status
  on public.recurring_series_requests (group_id, status, created_at desc)
  where group_id is not null;
-- Customer insert: own customer_id and (own series or own group).
drop policy if exists recurring_series_requests_insert_customer on public.recurring_series_requests;
create policy recurring_series_requests_insert_customer on public.recurring_series_requests
  for insert to authenticated
  with check (
    customer_id = public.auth_customer_id()
    and (
      (
        scope = 'series'
        and series_id is not null
        and exists (
          select 1
          from public.booking_series bs
          where bs.id = series_id
            and bs.customer_id = public.auth_customer_id()
        )
      )
      or (
        scope = 'group'
        and group_id is not null
        and exists (
          select 1
          from public.recurring_schedule_groups g
          where g.id = group_id
            and g.customer_id = public.auth_customer_id()
        )
      )
    )
  );
