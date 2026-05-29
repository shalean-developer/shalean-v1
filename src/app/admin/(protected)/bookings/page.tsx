import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, Settings2, Users } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { AdminBookingCard } from "@/components/admin/AdminControls";
import { AdminBookingsDataGrid } from "@/components/admin/AdminBookingsDataGrid";
import { Card } from "@/components/ui/card";
import { loadAdminBookings, loadAdminManagementData } from "@/lib/admin/data";
import { formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin Bookings | Shalean",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const actionError = getParam(params, "error");
  const actionSuccess = getParam(params, "success");
  const [management, bookings] = await Promise.all([
    loadAdminManagementData(),
    loadAdminBookings(100),
  ]);
  const pendingAssignment = bookings.filter((booking) => booking.booking_status === "confirmed" && booking.payment_status === "paid" && !booking.selected_cleaner_id).length;
  const paidCount = bookings.filter((booking) => (booking.payment?.status ?? booking.payment_status) === "paid").length;
  const revenueCents = bookings.reduce((total, booking) => total + booking.final_total_cents, 0);

  return (
    <div className="space-y-5">
      <AdminPageHeading eyebrow="Booking section" title="Bookings and assignment">
        Create bookings for existing customers and review bookings created from both customer checkout and admin-assisted flows.
      </AdminPageHeading>
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-200 bg-white p-5 text-slate-900">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-4 w-4 text-emerald-700" />
            <h3 className="text-lg font-bold">Operations overview</h3>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <MetricItem label="Recent bookings loaded" value={String(bookings.length)} />
            <MetricItem label="Pending assignment" value={String(pendingAssignment)} />
            <MetricItem label="Paid bookings" value={String(paidCount)} />
            <MetricItem label="Revenue in view" value={formatZar(revenueCents)} />
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-5 text-slate-900">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-700" />
            <h3 className="text-lg font-bold">Quick actions</h3>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <QuickAction href="/admin/customers" label="Open customer records" />
            <QuickAction href="/admin/cleaners" label="Open cleaner assignments" />
            <QuickAction href="/admin/payments" label="Review payments" />
            <QuickAction href="/admin/settings" label="Review admin settings" />
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-5 text-slate-900">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-violet-700" />
            <h3 className="text-lg font-bold">Booking management</h3>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Service: {bookings[0] ? slugToTitle(bookings[0].service_slug) : "Regular cleaning"}
          </p>
          <p className="mt-1 text-sm text-slate-600">Total cleaners in system: {management.cleaners.length}</p>
          <p className="mt-1 text-sm text-slate-600">Total customers in system: {management.customers.length}</p>
        </Card>
      </section>
      <section className="space-y-4">
        {actionSuccess ? <SuccessBanner code={actionSuccess} /> : null}
        {actionError === "catalog-config" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Regular Cleaning catalog configuration is incomplete. Ensure at least one active bedroom/bathroom pricing rule and at least one active equipment option are configured before creating admin bookings.
          </div>
        ) : actionError === "cleaner-unavailable" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Selected cleaner is currently unavailable for this suburb. Choose Auto-assign or select a different cleaner.
          </div>
        ) : actionError === "assignment-required" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Please choose a cleaner assignment option before creating the booking.
          </div>
        ) : actionError === "idempotency-required" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            The booking form was submitted before it was ready. Please wait a moment and try creating the booking again.
          </div>
        ) : actionError === "create-failed" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
            Admin booking could not be created due to a server error. Please verify the form details and try again.
          </div>
        ) : actionError === "payment-method-invalid" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
            Unsupported payment method selected. Choose one of the supported payment methods.
          </div>
        ) : null}
        {!management.hasActivePricingRules ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            No active Regular Cleaning pricing rules detected. Admin booking creation is disabled until pricing rules are activated.
          </div>
        ) : null}
        <AdminBookingCard
          customers={management.customers}
          cleaners={management.cleaners}
          addons={management.addons}
          equipmentOptions={management.equipmentOptions}
          hasActivePricingRules={management.hasActivePricingRules}
        />
        <div>
          <AdminBookingsDataGrid bookings={bookings} cleaners={management.cleaners} />
        </div>
      </section>
    </div>
  );
}

type BannerTone = "success" | "info" | "error";

const SUCCESS_BANNERS: Record<string, { tone: BannerTone; message: string }> = {
  "booking-created": { tone: "success", message: "Admin booking created successfully." },
  "booking-billed": { tone: "success", message: "Booking created. Unpaid invoice and Paystack payment link issued." },
  "invoice-created": { tone: "success", message: "Unpaid Zoho Books invoice created for this booking." },
  "zoho-synced": { tone: "success", message: "Zoho Books sync completed successfully." },
  "zoho-skipped": { tone: "info", message: "Zoho Books sync was skipped (integration not configured)." },
  "zoho-failed": { tone: "error", message: "Zoho Books sync failed. Review the error on the booking row and retry." },
  "link-sent": { tone: "success", message: "Payment link emailed to the customer." },
  "link-ready": { tone: "success", message: "Paystack payment link is ready for this booking." },
  "link-failed": { tone: "error", message: "Could not create or send the payment link. Check the customer email and Paystack configuration." },
  "payment-confirmed": { tone: "success", message: "Payment confirmed with Paystack. Booking marked as paid." },
  "payment-pending": { tone: "info", message: "Payment is still pending with Paystack." },
  "payment-check-failed": { tone: "error", message: "Could not verify the payment status with Paystack." },
  "payment-recorded": { tone: "success", message: "Payment recorded. Booking and Zoho invoice updated." },
  "payment-record-failed": { tone: "error", message: "Could not record the payment. Please try again." },
  "marked-unpaid": { tone: "info", message: "Booking reset to unpaid." },
  "invoice-voided": { tone: "info", message: "Zoho invoice voided for this booking." },
  "override-failed": { tone: "error", message: "Could not apply the override. Please try again." },
};

function SuccessBanner({ code }: { code: string }) {
  const banner = SUCCESS_BANNERS[code];
  if (!banner) return null;
  const tone = banner.tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : banner.tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-slate-200 bg-slate-50 text-slate-800";
  return <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tone}`}>{banner.message}</div>;
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
    >
      {label}
    </Link>
  );
}

function getParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}
