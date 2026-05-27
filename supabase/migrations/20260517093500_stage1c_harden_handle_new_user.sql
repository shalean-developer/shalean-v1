-- Stage 1C-1: Never trust raw_user_meta_data.role on auth signup.
-- All auth-triggered profiles default to customer; admin/cleaner via service-role flows only.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'customer',
    nullif(trim(new.raw_user_meta_data->>'full_name'), '')
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;
comment on function public.handle_new_user is
  'Creates a profiles row when auth.users is inserted. Role is always customer; raw_user_meta_data.role is never trusted.';
