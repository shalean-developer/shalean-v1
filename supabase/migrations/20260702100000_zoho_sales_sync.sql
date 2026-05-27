-- Shalean → Zoho accounting sales sync (bookings + registry for existing Zoho invoice payments).

create table if not exists public.zoho_sales_sync (
  id uuid primary key default gen_random_uuid(),
  source_type text not null
    check (source_type in ('booking', 'zoho_invoice_payment', 'zoho_authorization_charge')),
  source_id uuid not null,
  booking_id uuid,
  invoice_number text,
  zoho_invoice_id text,
  zoho_customer_id text,
  zoho_payment_id text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'failed')),
  sync_attempts integer not null default 0,
  last_sync_attempt_at timestamptz,
  next_sync_attempt_at timestamptz,
  last_sync_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz,
  constraint zoho_sales_sync_source_unique unique (source_type, source_id)
);
create index if not exists idx_zoho_sales_sync_sync_status
  on public.zoho_sales_sync (sync_status);
create index if not exists idx_zoho_sales_sync_booking_id
  on public.zoho_sales_sync (booking_id);
create index if not exists idx_zoho_sales_sync_invoice_number
  on public.zoho_sales_sync (invoice_number);
create index if not exists idx_zoho_sales_sync_next_sync_attempt_at
  on public.zoho_sales_sync (next_sync_attempt_at)
  where sync_status = 'pending';
alter table public.zoho_sales_sync enable row level security;
comment on table public.zoho_sales_sync is
  'Shalean sale → Zoho Books accounting sync queue. RLS enabled with no public policies; service_role only.';
