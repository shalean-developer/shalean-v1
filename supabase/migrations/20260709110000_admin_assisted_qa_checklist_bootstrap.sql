-- Bootstrap admin_assisted_qa_checklist when Phase 7B (081) was skipped but Phase 10 (091) ran.

create table if not exists public.admin_assisted_qa_checklist (
  booking_id uuid primary key
    references public.bookings (id) on delete cascade,

  admin_profile_id uuid not null
    references public.profiles (id) on delete restrict,

  items jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table public.admin_assisted_qa_checklist is
  'Operator QA checklist state for admin-assisted pilot dry-runs.';
create index if not exists idx_admin_assisted_qa_checklist_updated
  on public.admin_assisted_qa_checklist (updated_at desc);
alter table public.admin_assisted_qa_checklist enable row level security;
drop policy if exists admin_assisted_qa_checklist_select_admin
  on public.admin_assisted_qa_checklist;
create policy admin_assisted_qa_checklist_select_admin
  on public.admin_assisted_qa_checklist
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.admin_assisted_qa_checklist to authenticated, service_role;
grant insert, update on public.admin_assisted_qa_checklist to service_role;
