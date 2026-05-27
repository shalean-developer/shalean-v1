-- Reusable Paystack authorization storage for Zoho invoice payments (consent-gated).

create table if not exists public.zoho_invoice_payment_methods (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  customer_name text,
  paystack_customer_code text,
  authorization_code text not null,
  authorization_signature text,
  card_type text,
  bank text,
  last4 text,
  exp_month text,
  exp_year text,
  reusable boolean not null default false,
  is_default boolean not null default false,
  consent_text_version text not null,
  consented_at timestamptz not null,
  revoked_at timestamptz,
  source_invoice_number text,
  source_zoho_invoice_payment_id uuid references public.zoho_invoice_payments(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoho_invoice_payment_methods_authorization_code_unique unique (authorization_code)
);
create index if not exists idx_zoho_invoice_payment_methods_customer_email
  on public.zoho_invoice_payment_methods (customer_email);
create index if not exists idx_zoho_invoice_payment_methods_paystack_customer_code
  on public.zoho_invoice_payment_methods (paystack_customer_code);
create index if not exists idx_zoho_invoice_payment_methods_revoked_at
  on public.zoho_invoice_payment_methods (revoked_at);
create unique index if not exists zoho_invoice_payment_methods_one_default_per_customer
  on public.zoho_invoice_payment_methods (customer_email)
  where is_default = true and revoked_at is null;
alter table public.zoho_invoice_payment_methods enable row level security;
comment on table public.zoho_invoice_payment_methods is
  'Reusable Paystack authorizations saved after explicit customer consent on Zoho invoice checkout. RLS enabled with no public policies; service_role only.';
