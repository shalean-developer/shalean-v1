-- Phase 10: incident review tracking + operator lesson tags for admin-assisted booking.

create table if not exists public.admin_assisted_incident_reviews (
  id uuid primary key default gen_random_uuid(),

  incident_key text not null,
  booking_id uuid not null
    references public.bookings (id) on delete cascade,
  category text not null,

  status text not null default 'open',
  severity text not null,

  owner_profile_id uuid null
    references public.profiles (id) on delete set null,

  root_cause_notes text null,
  resolution_notes text null,
  follow_up_action text null,

  reviewed_at timestamptz null,
  reviewed_by uuid null
    references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admin_assisted_incident_reviews_key_unique
    unique (incident_key),

  constraint admin_assisted_incident_reviews_status_valid
    check (status in ('open', 'investigating', 'resolved', 'dismissed')),

  constraint admin_assisted_incident_reviews_severity_valid
    check (severity in ('critical', 'high', 'warning'))
);
comment on table public.admin_assisted_incident_reviews is
  'Human review state for admin-assisted booking incidents. Service-role writes only.';
create index if not exists idx_admin_assisted_incident_reviews_status
  on public.admin_assisted_incident_reviews (status, updated_at desc);
create index if not exists idx_admin_assisted_incident_reviews_booking
  on public.admin_assisted_incident_reviews (booking_id, updated_at desc);
alter table public.admin_assisted_incident_reviews enable row level security;
drop policy if exists admin_assisted_incident_reviews_select_admin
  on public.admin_assisted_incident_reviews;
create policy admin_assisted_incident_reviews_select_admin
  on public.admin_assisted_incident_reviews
  for select to authenticated
  using (public.auth_is_admin());
grant select on public.admin_assisted_incident_reviews to authenticated, service_role;
grant insert, update on public.admin_assisted_incident_reviews to service_role;
-- Ensure operator feedback exists (Phase 7B) before adding lesson fields.
-- Safe when 20260708100000_admin_assisted_pilot_operator_tools.sql was not applied yet.

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

  lesson_category text null,
  lesson_tags text[] not null default '{}'::text[],

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
-- Ensure QA checklist exists (Phase 7B) for admin booking detail + pilot dry-runs.
-- Safe when 20260708100000_admin_assisted_pilot_operator_tools.sql was not applied yet.

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
alter table public.admin_assisted_operator_feedback
  add column if not exists lesson_category text null,
  add column if not exists lesson_tags text[] not null default '{}'::text[];
alter table public.admin_assisted_operator_feedback
  drop constraint if exists admin_assisted_operator_feedback_lesson_category_valid;
alter table public.admin_assisted_operator_feedback
  add constraint admin_assisted_operator_feedback_lesson_category_valid
  check (
    lesson_category is null
    or lesson_category in (
      'confusing_step',
      'customer_question',
      'payment_issue',
      'recurring_issue',
      'cleaner_assignment_issue',
      'pricing_issue'
    )
  );
