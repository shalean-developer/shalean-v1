"use client";

import type React from "react";
import { ExternalLink } from "lucide-react";
import { AdminBookingRowActions } from "@/components/admin/AdminBookingRowActions";
import { AdminDrawer } from "@/components/admin/AdminDrawer";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import type { AdminBookingListItem, CleanerRow } from "@/lib/admin/data";
import {
  bookingSourceFor,
  formatBookingReference,
  paymentStatusForBooking,
} from "@/lib/admin/bookings-ui";
import { formatZar, slugToTitle } from "@/lib/utils";

export function AdminBookingDetailDrawer({
  booking,
  cleaners,
  adminCreatedBookingIds,
  open,
  onClose,
}: {
  booking: AdminBookingListItem | null;
  cleaners: CleanerRow[];
  adminCreatedBookingIds: ReadonlySet<string>;
  open: boolean;
  onClose: () => void;
}) {
  if (!booking) return null;

  const cleaner = cleaners.find((item) => item.id === booking.selected_cleaner_id);
  const cleanerName =
    cleaner?.display_name ?? cleaner?.full_name ?? (booking.selected_cleaner_id ? "Cleaner unavailable" : null);
  const paymentStatus = paymentStatusForBooking(booking);
  const source = bookingSourceFor(booking, adminCreatedBookingIds);
  const ref = formatBookingReference(booking);

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={ref}
      description="Booking details and operational actions"
      width="max-w-lg"
    >
      <div className="space-y-5">
        <section className="flex flex-wrap gap-2">
          <AdminStatusBadge kind="booking" value={booking.booking_status} />
          <AdminStatusBadge kind="payment" value={paymentStatus} />
          <AdminStatusBadge kind="invoice" value={booking.invoice_status ?? "pending"} />
          <AdminStatusBadge kind="zoho" value={booking.zoho_sync_status ?? "pending"} />
        </section>

        <DetailSection title="Customer">
          <DetailLine label="Name" value={booking.customer?.full_name ?? "Unavailable"} />
          <DetailLine label="Email" value={booking.customer?.email ?? "—"} />
          <DetailLine label="Phone" value={booking.customer?.phone ?? "—"} />
          <DetailLine label="Source" value={source === "admin" ? "Admin" : "Online"} />
        </DetailSection>

        <DetailSection title="Schedule">
          <DetailLine label="Date" value={booking.booking_date} />
          <DetailLine label="Time" value={booking.booking_time} />
          <DetailLine label="Service" value={slugToTitle(booking.service_slug)} />
        </DetailSection>

        <DetailSection title="Property">
          <DetailLine label="Address" value={`${booking.address}, ${booking.suburb}`} />
          <DetailLine
            label="Rooms"
            value={`${booking.bedrooms} bed · ${booking.bathrooms} bath · ${booking.extra_rooms} extra`}
          />
          {booking.access_notes ? (
            <DetailLine label="Access notes" value={booking.access_notes} />
          ) : null}
        </DetailSection>

        <DetailSection title="Cleaner assignment">
          <DetailLine
            label="Assigned"
            value={cleanerName ?? "Unassigned — dispatch pending"}
          />
        </DetailSection>

        <DetailSection title="Payment">
          <DetailLine label="Total" value={formatZar(booking.final_total_cents)} />
          <DetailLine label="Paid" value={formatZar(booking.amount_paid_cents)} />
          {booking.balance_remaining_cents != null && booking.balance_remaining_cents > 0 ? (
            <DetailLine label="Balance" value={formatZar(booking.balance_remaining_cents)} />
          ) : null}
          {booking.payment_method ? (
            <DetailLine label="Method" value={slugToTitle(booking.payment_method)} />
          ) : null}
        </DetailSection>

        <DetailSection title="Invoice & Zoho">
          <DetailLine label="Invoice status" value={booking.invoice_status ?? "pending"} />
          {booking.zoho_invoice_number ? (
            <DetailLine label="Invoice #" value={booking.zoho_invoice_number} />
          ) : null}
          {booking.zoho_invoice_url ? (
            <a
              href={booking.zoho_invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Zoho Books
            </a>
          ) : null}
          {booking.zoho_invoice_id ? (
            <a
              href={`/api/invoices/${booking.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Download PDF
            </a>
          ) : null}
          {booking.zoho_sync_error ? (
            <p className="mt-2 text-xs text-rose-700">{booking.zoho_sync_error}</p>
          ) : null}
        </DetailSection>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Actions</p>
          <div className="mt-3">
            <AdminBookingRowActions booking={booking} layout="stack" onView={onClose} />
          </div>
        </section>

        {/* Phase 2: load admin_booking_assist_audit rows for a full audit timeline */}
        <p className="text-xs text-slate-500">
          Admin audit log timeline can be added in Phase 2 when audit rows are loaded for this booking.
        </p>
      </div>
    </AdminDrawer>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        {children}
      </div>
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 sm:text-right">{value}</span>
    </div>
  );
}
