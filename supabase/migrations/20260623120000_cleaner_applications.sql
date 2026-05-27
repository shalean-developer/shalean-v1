-- Phase 2: Public cleaner application funnel (review queue — not operational cleaners).

create table if not exists public.cleaner_applications (
  id uuid primary key default gen_random_uuid(),

  full_name text not null,
  email text,
  phone text not null,
  phone_normalized text not null,

  suburb text,
  city text not null default 'Cape Town',

  experience_level text,
  has_own_transport boolean,
  has_cleaning_experience boolean,

  service_interests text[] not null default '{}',
  availability_days smallint[] not null default '{}',
  preferred_areas text[] not null default '{}',

  status text not null default 'new'
    check (status in ('new', 'reviewing', 'approved', 'rejected', 'duplicate')),

  source text not null default 'apply_page',
  notes text,
  admin_notes text,

  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,

  created_profile_id uuid references public.profiles (id) on delete set null,
  created_cleaner_id uuid references public.cleaners (id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.cleaner_applications is
  'Public cleaner recruitment applications. Reviewed by admin before provisioning inactive/onboarding cleaners.';
create index if not exists idx_cleaner_applications_phone_normalized
  on public.cleaner_applications (phone_normalized);
create index if not exists idx_cleaner_applications_email_lower
  on public.cleaner_applications (lower(email))
  where email is not null;
create index if not exists idx_cleaner_applications_status_created
  on public.cleaner_applications (status, created_at desc);
create index if not exists idx_cleaner_applications_created_cleaner
  on public.cleaner_applications (created_cleaner_id)
  where created_cleaner_id is not null;
create or replace function public.set_cleaner_applications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists cleaner_applications_set_updated_at on public.cleaner_applications;
create trigger cleaner_applications_set_updated_at
  before update on public.cleaner_applications
  for each row
  execute function public.set_cleaner_applications_updated_at();
alter table public.cleaner_applications enable row level security;
drop policy if exists cleaner_applications_select_admin on public.cleaner_applications;
create policy cleaner_applications_select_admin on public.cleaner_applications
  for select
  to authenticated
  using (public.auth_is_admin());
drop policy if exists cleaner_applications_update_admin on public.cleaner_applications;
create policy cleaner_applications_update_admin on public.cleaner_applications
  for update
  to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
grant select, update on public.cleaner_applications to authenticated;
grant all on public.cleaner_applications to service_role;
