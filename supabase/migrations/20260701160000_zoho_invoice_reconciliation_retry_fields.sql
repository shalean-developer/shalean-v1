-- Phase 4: reconciliation retry scheduling fields for zoho_invoice_payments.

alter table public.zoho_invoice_payments
  add column if not exists reconcile_attempts integer not null default 0,
  add column if not exists last_reconcile_attempt_at timestamptz,
  add column if not exists next_reconcile_attempt_at timestamptz,
  add column if not exists last_reconcile_error text;
create index if not exists idx_zoho_invoice_payments_next_reconcile_attempt_at
  on public.zoho_invoice_payments (next_reconcile_attempt_at);
create index if not exists idx_zoho_invoice_payments_reconcile_pending
  on public.zoho_invoice_payments (next_reconcile_attempt_at, created_at)
  where status = 'zoho_reconcile_pending';
