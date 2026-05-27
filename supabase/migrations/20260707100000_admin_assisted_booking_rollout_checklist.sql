-- Admin-assisted booking production rollout checklist (Phase 6).

insert into public.production_rollout_checklist (checklist_key, label, category)
values
  (
    'admin_assisted_booking_draft_tested',
    'Admin-assisted draft creation tested',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_pending_payment_tested',
    'Admin-assisted pending payment tested',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_payment_link_tested',
    'Admin-assisted Paystack payment link tested',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_payment_request_email_tested',
    'Admin-assisted payment request email tested',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_offline_payment_eft_tested',
    'Admin-assisted offline EFT payment tested',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_offline_payment_cash_tested',
    'Admin-assisted offline cash payment tested',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_offline_payment_card_machine_tested',
    'Admin-assisted offline card machine payment tested',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_assignment_parity_verified',
    'Assignment parity verified after admin-assisted payment',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_customer_visibility_verified',
    'Customer dashboard visibility verified for admin-assisted bookings',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_cleaner_visibility_verified',
    'Cleaner dashboard visibility verified (post-assignment only)',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_payout_safety_verified',
    'No premature earnings/payout from admin-assisted path verified',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_webhook_parity_verified',
    'Paystack webhook/verify parity with customer bookings verified',
    'admin_assisted_booking'
  ),
  (
    'admin_assisted_feature_flags_verified',
    'Admin-assisted feature flags staged rollout verified',
    'admin_assisted_booking'
  )
on conflict (checklist_key) do nothing;
