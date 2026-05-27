-- Zoho refund/credit note accounting sync (bookings, invoice payments, auth charges).

create table if not exists public.zoho_refund_credit_sync (
  id uuid primary key default gen_random_uuid(),
  source_type text not null
    check (source_type in (
      'booking_refund',
      'booking_cancellation',
      'zoho_invoice_refund',
      'zoho_authorization_charge_refund'
    )),
  source_id uuid not null,
  booking_id uuid,
  invoice_number text,
  zoho_invoice_id text,
  zoho_credit_note_id text,
  zoho_refund_id text,
  paystack_reference text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  reason text not null,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'failed')),
  sync_attempts integer not null default 0,
  last_sync_attempt_at timestamptz,
  next_sync_attempt_at timestamptz,
  last_sync_error text,
  metadata jsonb not null default '{}'::jsonb,
  initiated_by_admin_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz,
  constraint zoho_refund_credit_sync_source_unique unique (source_type, source_id)
);
create index if not exists idx_zoho_refund_credit_sync_sync_status
  on public.zoho_refund_credit_sync (sync_status);
create index if not exists idx_zoho_refund_credit_sync_booking_id
  on public.zoho_refund_credit_sync (booking_id);
create index if not exists idx_zoho_refund_credit_sync_invoice_number
  on public.zoho_refund_credit_sync (invoice_number);
create index if not exists idx_zoho_refund_credit_sync_next_sync_attempt_at
  on public.zoho_refund_credit_sync (next_sync_attempt_at)
  where sync_status = 'pending';
alter table public.zoho_refund_credit_sync enable row level security;
comment on table public.zoho_refund_credit_sync is
  'Shalean refund/cancellation → Zoho Books credit note sync queue. RLS enabled with no public policies; service_role only.';
