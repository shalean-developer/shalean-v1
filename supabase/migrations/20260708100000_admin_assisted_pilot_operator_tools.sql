-- Phase 7B: operator feedback + per-booking QA checklist for admin-assisted pilot.

create table if not exists public.admin_assisted_operator_feedback (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings (id) on delete cascade,

  admin_profile_id uuid not null
    references public.profiles (id) on delete restrict,

  confusing_text text null,
  slowed_down_text text null,
  payment_succeeded boolean null,
  customer_understood boolean null,
  notes text null,

  created_at timestamptz not null default now(),

  constraint admin_assisted_operator_feedback_notes_safe
    check (notes is null or length(trim(notes)) <= 2000)
);
comment on table public.admin_assisted_operator_feedback is
  'Optional operator feedback during admin-assisted booking pilot. No payment card data.';
create index if not exists idx_admin_assisted_operator_feedback_booking_created
  on public.admin_assisted_operator_feedback (booking_id, created_at desc);
create index if not exists idx_admin_assisted_operator_feedback_admin_created
  on public.admin_assisted_operator_feedback (admin_profile_id, created_at desc);
alter table public.admin_assisted_operator_feedback enable row level security;
drop policy if exists admin_assisted_operator_feedback_select_admin
  on public.admin_assisted_operator_feedback;
create policy admin_assisted_operator_feedback_select_admin
  on public.admin_assisted_operator_feedback
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.admin_assisted_operator_feedback to authenticated, service_role;
grant insert on public.admin_assisted_operator_feedback to service_role;
-- Per-booking QA checklist (upsertable by operators via service-role API).

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
