-- Production rollout checklist for staged finance/payment enablement (Phase 19).

create table if not exists public.production_rollout_checklist (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null unique,
  label text not null,
  category text not null,
  completed boolean not null default false,
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_production_rollout_checklist_category
  on public.production_rollout_checklist (category);
alter table public.production_rollout_checklist enable row level security;
comment on table public.production_rollout_checklist is
  'Admin production rollout QA checklist. RLS enabled with no public policies; service_role only.';
insert into public.production_rollout_checklist (checklist_key, label, category)
values
  ('app_base_url_configured', 'Production APP_BASE_URL configured', 'core_setup'),
  ('webhook_configured', 'Paystack live webhook configured', 'core_setup'),
  ('zoho_oauth_configured', 'Zoho OAuth configured', 'core_setup'),
  ('cron_configured', 'Cron jobs configured', 'core_setup'),
  ('live_payment_test_completed', 'Low-value invoice payment tested in live mode', 'live_qa'),
  ('saved_method_test_completed', 'Saved payment method tested', 'live_qa'),
  ('refund_test_completed', 'Refund / credit sync tested', 'live_qa'),
  ('finance_reconciliation_reviewed', 'Finance reconciliation reviewed', 'live_qa'),
  ('accounting_close_reviewed', 'Accounting close reviewed', 'live_qa'),
  ('invoice_payments_rollout_ack', 'Invoice payments rollout acknowledged', 'controlled_rollout'),
  ('saved_methods_rollout_ack', 'Saved methods rollout acknowledged', 'controlled_rollout'),
  ('sales_sync_rollout_ack', 'Sales sync rollout acknowledged', 'controlled_rollout'),
  ('refund_sync_rollout_ack', 'Refund sync rollout acknowledged', 'controlled_rollout'),
  ('admin_charges_disabled_ack', 'Admin card charges remain disabled', 'controlled_rollout'),
  ('admin_charge_test_completed', 'Admin card charge tested (sign-off)', 'final_enablement')
on conflict (checklist_key) do nothing;
