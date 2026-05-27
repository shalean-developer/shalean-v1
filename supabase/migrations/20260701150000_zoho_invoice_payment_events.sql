-- Phase 3: idempotent Paystack webhook event log for Zoho invoice payments.

create table if not exists public.zoho_invoice_payment_events (
  id uuid primary key default gen_random_uuid(),
  zoho_invoice_payment_id uuid not null references public.zoho_invoice_payments (id) on delete cascade,
  provider_event_id text not null,
  event_type text not null,
  paystack_reference text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  constraint zoho_invoice_payment_events_provider_event_id_unique unique (provider_event_id)
);
create index if not exists zoho_invoice_payment_events_payment_id_idx
  on public.zoho_invoice_payment_events (zoho_invoice_payment_id);
create index if not exists zoho_invoice_payment_events_paystack_reference_idx
  on public.zoho_invoice_payment_events (paystack_reference);
alter table public.zoho_invoice_payment_events enable row level security;
