-- Zoho manual invoice Paystack checkout attempts (isolated from booking payments).

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'zoho_invoice_payment_status'
  ) then
    create type public.zoho_invoice_payment_status as enum (
      'initialized',
      'pending_paystack',
      'paid',
      'failed',
      'zoho_reconcile_pending',
      'zoho_reconcile_failed',
      'cancelled'
    );
  end if;
end
$$;
create table if not exists public.zoho_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  zoho_invoice_id text not null,
  customer_name text,
  customer_email text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  paystack_reference text,
  paystack_access_code text,
  paystack_authorization_url text,
  paystack_status text,
  zoho_payment_id text,
  zoho_status text,
  status public.zoho_invoice_payment_status not null default 'initialized',
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint zoho_invoice_payments_idempotency_key_unique unique (idempotency_key),
  constraint zoho_invoice_payments_paystack_reference_unique unique (paystack_reference)
);
create index if not exists idx_zoho_invoice_payments_invoice_number
  on public.zoho_invoice_payments (invoice_number);
create index if not exists idx_zoho_invoice_payments_status
  on public.zoho_invoice_payments (status);
create unique index if not exists zoho_invoice_payments_one_active_per_invoice
  on public.zoho_invoice_payments (invoice_number)
  where status in ('initialized', 'pending_paystack', 'zoho_reconcile_pending');
alter table public.zoho_invoice_payments enable row level security;
comment on table public.zoho_invoice_payments is
  'Manual Zoho invoice Paystack checkout attempts. RLS enabled with no public policies; service_role only.';
