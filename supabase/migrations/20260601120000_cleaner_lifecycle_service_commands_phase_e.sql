-- Cleaner lifecycle service commands Phase E (PR-E):
-- Helper to set transaction-local bypass for guard_cleaner_lifecycle_columns.
-- Called from server-side lifecycle commands before updating public.cleaners.

create or replace function public.enable_cleaner_lifecycle_column_write()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.cleaner_lifecycle_column_write', '1', true);
end;
$$;
comment on function public.enable_cleaner_lifecycle_column_write is
  'Sets app.cleaner_lifecycle_column_write for the current transaction so lifecycle service commands can update guarded cleaner columns.';
revoke all on function public.enable_cleaner_lifecycle_column_write() from public;
grant execute on function public.enable_cleaner_lifecycle_column_write() to service_role;
