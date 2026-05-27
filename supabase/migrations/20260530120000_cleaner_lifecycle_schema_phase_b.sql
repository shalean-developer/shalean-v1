-- Cleaner lifecycle schema Phase B (PR-B):
-- Lifecycle columns on cleaners, durable cleaner_operational_audit, indexes, RLS.
-- No RPCs, UI, assignment guards, or behavior changes — schema foundation only.

-- ---------------------------------------------------------------------------
-- 1) Cleaner lifecycle columns
-- ---------------------------------------------------------------------------

alter table public.cleaners
  add column if not exists deleted_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists suspension_ends_at timestamptz,
  add column if not exists lifecycle_reason text;
comment on column public.cleaners.deleted_at is
  'Soft-delete marker (Phase B schema). Behavior wired in a later phase.';
comment on column public.cleaners.onboarding_completed_at is
  'When cleaner finished onboarding. Backfilled from created_at for existing rows.';
comment on column public.cleaners.suspension_ends_at is
  'Optional end of a timed suspension window (pairs with suspended_at).';
comment on column public.cleaners.lifecycle_reason is
  'Last admin-documented lifecycle reason (Phase B schema; commands in later phase).';
-- ---------------------------------------------------------------------------
-- 2) Backfill onboarding_completed_at for existing cleaners
-- ---------------------------------------------------------------------------

update public.cleaners
set onboarding_completed_at = created_at
where onboarding_completed_at is null;
-- ---------------------------------------------------------------------------
-- 3) Partial indexes for lifecycle queries
-- ---------------------------------------------------------------------------

create index if not exists idx_cleaners_not_deleted
  on public.cleaners (id)
  where deleted_at is null;
create index if not exists idx_cleaners_active_not_deleted
  on public.cleaners (id)
  where deleted_at is null
    and active = true;
create index if not exists idx_cleaners_suspended_window
  on public.cleaners (suspended_at, suspension_ends_at)
  where suspended_at is not null;
-- ---------------------------------------------------------------------------
-- 4) cleaner_operational_audit (append-only, admin-read, service-role insert)
-- ---------------------------------------------------------------------------

create table if not exists public.cleaner_operational_audit (
  id uuid primary key default gen_random_uuid(),

  cleaner_id uuid not null
    references public.cleaners (id) on delete restrict,

  admin_profile_id uuid
    references public.profiles (id) on delete set null,

  action text not null,
  outcome text not null,
  reason text,

  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  affected_counts jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  idempotency_key text,

  created_at timestamptz not null default now(),

  constraint cleaner_operational_audit_action_nonempty
    check (length(trim(action)) > 0),

  constraint cleaner_operational_audit_outcome_nonempty
    check (length(trim(outcome)) > 0)
);
comment on table public.cleaner_operational_audit is
  'Append-only log of admin cleaner lifecycle operations. Schema-only in Phase B; writers in later phase.';
create unique index if not exists cleaner_operational_audit_idempotency_unique
  on public.cleaner_operational_audit (idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_cleaner_operational_audit_cleaner_created
  on public.cleaner_operational_audit (cleaner_id, created_at desc);
create index if not exists idx_cleaner_operational_audit_admin_created
  on public.cleaner_operational_audit (admin_profile_id, created_at desc)
  where admin_profile_id is not null;
create index if not exists idx_cleaner_operational_audit_action_created
  on public.cleaner_operational_audit (action, created_at desc);
-- Append-only (same pattern as admin_operational_audit)
create or replace function public.forbid_cleaner_operational_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'cleaner_operational_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;
drop trigger if exists cleaner_operational_audit_append_only on public.cleaner_operational_audit;
create trigger cleaner_operational_audit_append_only
  before update or delete on public.cleaner_operational_audit
  for each row
  execute function public.forbid_cleaner_operational_audit_mutation();
alter table public.cleaner_operational_audit enable row level security;
drop policy if exists cleaner_operational_audit_select_admin on public.cleaner_operational_audit;
create policy cleaner_operational_audit_select_admin on public.cleaner_operational_audit
  for select to authenticated
  using (public.auth_is_admin());
-- No INSERT/UPDATE/DELETE policies for authenticated — writes via service_role only.

grant select on public.cleaner_operational_audit to authenticated, service_role;
grant insert on public.cleaner_operational_audit to service_role;
