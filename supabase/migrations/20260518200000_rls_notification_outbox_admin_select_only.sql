-- Stage 5F-a: Remove admin JWT/PostgREST write access on notification_outbox.
-- Admin reads via notification_outbox_select_admin; enqueue, worker, and requeue remain service_role.
-- Rollback: docs/operations/rls-tightening-rollbacks.md

drop policy if exists notification_outbox_admin on public.notification_outbox;
drop policy if exists notification_outbox_select_admin on public.notification_outbox;
create policy notification_outbox_select_admin on public.notification_outbox
  for select to authenticated
  using (public.auth_is_admin());
comment on table public.notification_outbox is
  'Reliable outbound notifications with retries. Enqueue and delivery via service_role; admin authenticated: SELECT only (5F).';
