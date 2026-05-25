create extension if not exists "pgcrypto";

create type public.user_role as enum ('customer', 'cleaner', 'admin', 'dispatcher', 'finance');
create type public.booking_status as enum (
  'draft',
  'quote_ready',
  'payment_pending',
  'paid',
  'assignment_pending',
  'offered',
  'assigned',
  'in_progress',
  'completed',
  'payout_ready',
  'paid_out',
  'cancelled',
  'refunded'
);
create type public.assignment_mode as enum ('auto', 'preferred_cleaner', 'customer_team', 'manual_admin');
create type public.payment_status as enum ('pending', 'authorized', 'paid', 'failed', 'refunded');
create type public.payout_status as enum ('pending', 'approved', 'processing', 'paid', 'blocked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  base_cents integer not null check (base_cents > 0),
  min_hours numeric(4, 1) not null check (min_hours > 0),
  requires_team boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cleaners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  verification_status text not null default 'pending',
  tenure_months integer not null default 0 check (tenure_months >= 0),
  rating numeric(3, 2) not null default 5,
  bank_account_verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cleaner_availability (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners(id) on delete cascade,
  available_date date not null,
  starts_at time not null,
  ends_at time not null,
  unique (cleaner_id, available_date, starts_at)
);

create table public.cleaning_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.cleaning_team_members (
  team_id uuid not null references public.cleaning_teams(id) on delete cascade,
  cleaner_id uuid not null references public.cleaners(id) on delete cascade,
  is_lead boolean not null default false,
  primary key (team_id, cleaner_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id),
  service_id uuid not null references public.services(id),
  status public.booking_status not null default 'draft',
  assignment_mode public.assignment_mode not null default 'auto',
  scheduled_date date,
  time_window text,
  address_line text not null,
  suburb text not null,
  property_details jsonb not null default '{}'::jsonb,
  add_ons jsonb not null default '{}'::jsonb,
  frequency text not null default 'once',
  requested_cleaners integer not null default 1 check (requested_cleaners > 0),
  quote_cents integer not null check (quote_cents >= 25000),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  estimated_hours numeric(5, 2) not null check (estimated_hours > 0),
  notes text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  cleaner_id uuid references public.cleaners(id),
  team_id uuid references public.cleaning_teams(id),
  status text not null default 'offered',
  offered_at timestamptz,
  accepted_at timestamptz,
  check_in_at timestamptz,
  check_out_at timestamptz,
  constraint assignment_target check (cleaner_id is not null or team_id is not null)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null default 'paystack',
  provider_reference text not null unique,
  status public.payment_status not null default 'pending',
  amount_cents integer not null check (amount_cents > 0),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  cleaner_id uuid not null references public.cleaners(id),
  status public.payout_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 25000),
  rule text not null,
  approved_by uuid references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  recipient text not null,
  template_key text not null,
  status text not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index bookings_status_idx on public.bookings(status);
create index bookings_suburb_idx on public.bookings(suburb);
create index assignments_booking_idx on public.booking_assignments(booking_id);
create index payouts_status_idx on public.payouts(status);
create index audit_entity_idx on public.audit_events(entity_type, entity_id);

alter table public.profiles enable row level security;
alter table public.cleaners enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_assignments enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "customers can read own bookings"
  on public.bookings for select
  using (customer_id = auth.uid());

create policy "admins can read bookings"
  on public.bookings for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'dispatcher', 'finance')
    )
  );

create policy "cleaners can read assigned jobs"
  on public.booking_assignments for select
  using (
    exists (
      select 1 from public.cleaners
      where cleaners.id = booking_assignments.cleaner_id
      and cleaners.profile_id = auth.uid()
    )
  );
