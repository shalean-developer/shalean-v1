-- Cleaner lifecycle column guard Phase C (PR-C):
-- Block authenticated direct UPDATE of lifecycle columns on public.cleaners.
-- Allows service_role (auth.uid() is null) and future SECURITY DEFINER lifecycle RPCs
-- via transaction-local app.cleaner_lifecycle_column_write = '1'.

create or replace function public.guard_cleaner_lifecycle_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- service_role / postgres direct writes (no end-user JWT)
  if auth.uid() is null then
    return new;
  end if;

  -- Future SECURITY DEFINER lifecycle commands set this before updating cleaners:
  --   perform set_config('app.cleaner_lifecycle_column_write', '1', true);
  if coalesce(
    nullif(current_setting('app.cleaner_lifecycle_column_write', true), ''),
    '0'
  ) = '1' then
    return new;
  end if;

  if new.active is distinct from old.active
     or new.suspended_at is distinct from old.suspended_at
     or new.suspension_ends_at is distinct from old.suspension_ends_at
     or new.deleted_at is distinct from old.deleted_at
     or new.onboarding_completed_at is distinct from old.onboarding_completed_at
     or new.lifecycle_reason is distinct from old.lifecycle_reason then
    raise exception 'CLEANER_LIFECYCLE_COLUMN_MUTATION_FORBIDDEN';
  end if;

  return new;
end;
$$;
comment on function public.guard_cleaner_lifecycle_columns is
  'Blocks authenticated JWT sessions from mutating cleaner lifecycle columns. service_role and lifecycle RPC bypass allowed.';
drop trigger if exists guard_cleaner_lifecycle_columns on public.cleaners;
create trigger guard_cleaner_lifecycle_columns
  before update on public.cleaners
  for each row
  execute function public.guard_cleaner_lifecycle_columns();
comment on table public.cleaners is
  'Cleaner identity row. Hard DELETE blocked for authenticated (Phase A). Lifecycle column writes via service_role or lifecycle RPCs only (Phase C).';
