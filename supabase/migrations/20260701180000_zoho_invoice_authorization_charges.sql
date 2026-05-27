-- Admin-initiated saved-card charges for Zoho invoices.

create table if not exists public.zoho_invoice_authorization_charges (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  zoho_invoice_id text not null,
  payment_method_id uuid not null references public.zoho_invoice_payment_methods(id),
  customer_email text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  paystack_reference text not null,
  paystack_status text,
  zoho_payment_id text,
  zoho_status text,
  status text not null default 'initialized',
  initiated_by_admin_id uuid not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  reconcile_attempts integer not null default 0,
  last_reconcile_attempt_at timestamptz,
  next_reconcile_attempt_at timestamptz,
  last_reconcile_error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  failed_at timestamptz,
  constraint zoho_invoice_authorization_charges_paystack_reference_unique unique (paystack_reference),
  constraint zoho_invoice_authorization_charges_status_check
    check (status in (
      'initialized',
      'submitted',
      'pending_webhook',
      'paid',
      'failed',
      'zoho_reconcile_pending',
      'zoho_reconcile_failed'
    ))
);
create index if not exists idx_zoho_invoice_authorization_charges_invoice_number
  on public.zoho_invoice_authorization_charges (invoice_number);
create index if not exists idx_zoho_invoice_authorization_charges_payment_method_id
  on public.zoho_invoice_authorization_charges (payment_method_id);
create index if not exists idx_zoho_invoice_authorization_charges_status
  on public.zoho_invoice_authorization_charges (status);
create index if not exists idx_zoho_invoice_authorization_charges_initiated_by_admin_id
  on public.zoho_invoice_authorization_charges (initiated_by_admin_id);
create unique index if not exists zoho_invoice_authorization_charges_one_active_per_invoice
  on public.zoho_invoice_authorization_charges (invoice_number)
  where status in ('initialized', 'submitted', 'pending_webhook', 'zoho_reconcile_pending');
create index if not exists idx_zoho_invoice_authorization_charges_reconcile_pending
  on public.zoho_invoice_authorization_charges (next_reconcile_attempt_at)
  where status = 'zoho_reconcile_pending';
alter table public.zoho_invoice_authorization_charges enable row level security;
comment on table public.zoho_invoice_authorization_charges is
  'Admin-initiated Paystack charge_authorization attempts for Zoho invoices. RLS enabled with no public policies; service_role only.';
create table if not exists public.zoho_invoice_authorization_charge_events (
  id uuid primary key default gen_random_uuid(),
  authorization_charge_id uuid not null
    references public.zoho_invoice_authorization_charges(id) on delete cascade,
  provider_event_id text not null,
  event_type text not null,
  paystack_reference text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  constraint zoho_invoice_authorization_charge_events_provider_event_id_unique
    unique (provider_event_id)
);
create index if not exists idx_zoho_invoice_authorization_charge_events_charge_id
  on public.zoho_invoice_authorization_charge_events (authorization_charge_id);
alter table public.zoho_invoice_authorization_charge_events enable row level security;
comment on table public.zoho_invoice_authorization_charge_events is
  'Webhook idempotency log for admin authorization charges. RLS enabled with no public policies; service_role only.';
