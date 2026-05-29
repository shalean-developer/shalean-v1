-- Zoho Books accounting sync state on bookings.
-- When a booking is paid, the customer + invoice are synced to Zoho Books and
-- the returned identifiers / status are stored here. All sync work happens
-- server-side; these columns are read-only references for admin visibility.

alter table public.bookings
  add column if not exists zoho_contact_id text,
  add column if not exists zoho_invoice_id text,
  add column if not exists zoho_invoice_number text,
  add column if not exists zoho_invoice_url text,
  add column if not exists zoho_sync_status text not null default 'pending',
  add column if not exists zoho_sync_error text,
  add column if not exists zoho_sync_attempts integer not null default 0,
  add column if not exists zoho_synced_at timestamptz;

-- Constrain sync status to the canonical set. Added separately so the migration
-- stays idempotent across partially-applied environments.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_zoho_sync_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_zoho_sync_status_check
      check (zoho_sync_status in ('pending', 'synced', 'failed', 'skipped'));
  end if;
end
$$;

create index if not exists idx_bookings_zoho_sync_status
  on public.bookings (zoho_sync_status);

comment on column public.bookings.zoho_contact_id is
  'Zoho Books contact (customer) id linked to this booking. Set by syncBookingToZohoBooks.';
comment on column public.bookings.zoho_invoice_id is
  'Zoho Books invoice id created for this paid booking. Set by syncBookingToZohoBooks.';
comment on column public.bookings.zoho_invoice_number is
  'Human-readable Zoho Books invoice number for admin display.';
comment on column public.bookings.zoho_invoice_url is
  'Deep link to the Zoho Books invoice in the Zoho web app.';
comment on column public.bookings.zoho_sync_status is
  'Booking → Zoho Books sync state: pending (not yet attempted), synced, failed (retryable), skipped (Zoho not configured).';
comment on column public.bookings.zoho_sync_error is
  'Last Zoho sync error message, surfaced to admins to support retries.';
