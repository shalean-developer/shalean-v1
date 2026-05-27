-- Safe auth.users → public.profiles bootstrap for signup and admin createUser.
-- Fixes "Database error creating new user" when a trigger omits NOT NULL columns (e.g. role).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'customer';
begin
  if new.raw_user_meta_data ? 'role' then
    begin
      v_role := (new.raw_user_meta_data->>'role')::public.user_role;
    exception
      when others then
        v_role := 'customer';
    end;
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    v_role,
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
  'Creates a profiles row when auth.users is inserted. Required for admin createUser and signup.';
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
grant usage on schema public to supabase_auth_admin;
grant insert, update on table public.profiles to supabase_auth_admin;
grant execute on function public.handle_new_user() to supabase_auth_admin;
