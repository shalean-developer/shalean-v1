-- Stage 5E-1a: Allow notification_requeue in admin_operational_audit.action check.

alter table public.admin_operational_audit
  drop constraint if exists admin_operational_audit_action_check;
alter table public.admin_operational_audit
  add constraint admin_operational_audit_action_check
  check (action in (
    'assignment_recovery',
    'manual_dispatch_offer',
    'replace_open_offer',
    'notification_requeue'
  ));
