import type { Metadata } from "next";
import { AdminBookingsWorkspace } from "@/components/admin/AdminBookingsWorkspace";
import { computeBookingsActionMetrics } from "@/lib/admin/bookings-ui";
import {
  loadAdminBookings,
  loadAdminCreatedBookingIds,
  loadAdminManagementData,
} from "@/lib/admin/data";

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

  const [management, bookings, adminCreatedBookingIds] = await Promise.all([
    loadAdminManagementData(),
    loadAdminBookings(100),
    loadAdminCreatedBookingIds(),
  ]);

  const metrics = computeBookingsActionMetrics(bookings);

  return (
    <AdminBookingsWorkspace
      bookings={bookings}
      cleaners={management.cleaners}
      customers={management.customers}
      addons={management.addons}
      equipmentOptions={management.equipmentOptions}
      hasActivePricingRules={management.hasActivePricingRules}
      metrics={metrics}
      adminCreatedBookingIds={Array.from(adminCreatedBookingIds)}
      banners={
        <>
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
        </>
      }
    />
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
  const tone =
    banner.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : banner.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tone}`}>{banner.message}</div>
  );
}

function getParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}
