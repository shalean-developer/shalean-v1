-- Phase 9: payment method management fields and audit trail.

alter table public.zoho_invoice_payment_methods
  add column if not exists revoke_reason text,
  add column if not exists revoked_by_user_id uuid,
  add column if not exists revoked_by_admin_id uuid,
  add column if not exists revocation_source text,
  add column if not exists last_used_at timestamptz,
  add column if not exists last_used_invoice_number text;
alter table public.zoho_invoice_payment_methods
  drop constraint if exists zoho_invoice_payment_methods_revocation_source_check;
alter table public.zoho_invoice_payment_methods
  add constraint zoho_invoice_payment_methods_revocation_source_check
    check (revocation_source is null or revocation_source in ('customer', 'admin', 'system'));
create table if not exists public.zoho_invoice_payment_method_audit (
  id uuid primary key default gen_random_uuid(),
  payment_method_id uuid not null
    references public.zoho_invoice_payment_methods(id) on delete cascade,
  action text not null,
  actor_type text not null,
  actor_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint zoho_invoice_payment_method_audit_actor_type_check
    check (actor_type in ('customer', 'admin', 'system'))
);
create index if not exists idx_zoho_invoice_payment_method_audit_payment_method_id
  on public.zoho_invoice_payment_method_audit (payment_method_id);
create index if not exists idx_zoho_invoice_payment_method_audit_action
  on public.zoho_invoice_payment_method_audit (action);
create index if not exists idx_zoho_invoice_payment_method_audit_actor_type
  on public.zoho_invoice_payment_method_audit (actor_type);
create index if not exists idx_zoho_invoice_payment_method_audit_created_at
  on public.zoho_invoice_payment_method_audit (created_at);
alter table public.zoho_invoice_payment_method_audit enable row level security;
comment on table public.zoho_invoice_payment_method_audit is
  'Audit log for saved Zoho invoice payment method lifecycle actions. RLS enabled with no public policies; service_role only.';
