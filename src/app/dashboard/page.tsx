import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClearBookingDraft } from "@/components/booking/ClearBookingDraft";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { requireCustomer } from "@/lib/auth/server";
import { loadCustomerBookingDetail } from "@/lib/dashboard/data";
import { reconcilePaystackPayment } from "@/lib/payments/reconciliation";
import { formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Booking Details | Shalean",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerDashboardPage({ searchParams }: PageProps) {
  const { user } = await requireCustomer();
  const params = await searchParams;
  const bookingId = getParam(params, "booking");
  const reference = getParam(params, "reference") ?? getParam(params, "trxref");
  let reconciliationMessage: string | null = null;

  if (bookingId && reference) {
    try {
      const result = await reconcilePaystackPayment({ bookingId, reference, source: "callback" });
      reconciliationMessage = result.reconciled
        ? "Payment confirmed with Paystack."
        : `Paystack status is ${result.providerStatus}.`;
    } catch (error) {
      reconciliationMessage = error instanceof Error ? error.message : "Unable to verify Paystack payment.";
    }
  }

  const { booking } = await loadCustomerBookingDetail({ bookingId, customerAuthUserId: user.id });

  return (
    <DashboardShell title="Booking details" eyebrow="Customer booking">
      <ClearBookingDraft enabled={booking?.payment_status === "paid"} />

      {reconciliationMessage ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {reconciliationMessage}
        </Card>
      ) : null}

      {!booking ? (
        <Card className="p-5">
          <h2 className="text-xl font-bold">No booking found</h2>
          <p className="mt-2 text-sm text-slate-600">Your Regular Cleaning bookings will appear after checkout starts.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <PrimaryLink href="/bookings">All bookings</PrimaryLink>
            <SecondaryLink href="/book?new=1">Start new booking</SecondaryLink>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{booking.payment_status === "paid" ? "Paid" : slugToTitle(booking.payment_status)}</Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700">{slugToTitle(booking.booking_status)}</Badge>
                  {booking.recurringSeries ? <Badge>Recurring series</Badge> : null}
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">
                  {slugToTitle(booking.service_slug)} in {booking.suburb}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {formatDate(booking.booking_date)}, {formatTimeWindow(booking.booking_time)}. {formatCleaner(booking)}
                </p>
                <p className="mt-2 text-sm text-slate-600">{booking.address}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <SecondaryLink href="/bookings">All bookings</SecondaryLink>
                <PrimaryLink href="/book?new=1">Start new booking</PrimaryLink>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Per visit" value={formatZar(getPerVisitAmount(booking))} />
              <Stat label={booking.recurringSeries ? "Series paid" : "Total"} value={formatZar(getPaymentAmount(booking))} />
              <Stat label="Next step" value={getNextStep(booking.payment_status, booking.booking_status)} />
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="p-5">
              <h2 className="text-xl font-bold">Visit preparation</h2>
              <div className="mt-5 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                <SummaryRow label="Service" value={slugToTitle(booking.service_slug)} />
                <SummaryRow label="Suburb" value={booking.suburb} />
                <SummaryRow label="Address" value={booking.address} />
                <SummaryRow label="Arrival window" value={formatTimeWindow(booking.booking_time)} />
                <SummaryRow label="Bedrooms" value={String(booking.bedrooms)} />
                <SummaryRow label="Bathrooms" value={String(booking.bathrooms)} />
                <SummaryRow label="Extra rooms" value={String(booking.extra_rooms)} />
                <SummaryRow label="Cleaners requested" value={`${booking.cleaner_count} cleaner${booking.cleaner_count === 1 ? "" : "s"}`} />
                <SummaryRow label="Premium add-ons" value={formatAddons(booking.addons)} wide />
                <SummaryRow label="Cleaning equipment" value={booking.equipment?.label ?? slugToTitle(booking.equipment_option)} wide />
                <SummaryRow label="Cleaner assignment" value={formatAssignment(booking)} wide />
                {booking.access_notes ? <SummaryRow label="Access notes" value={booking.access_notes} wide /> : null}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-xl font-bold">Booking tracking</h2>
              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                {buildTrackingSteps(booking.payment_status, booking.booking_status).map((state, index) => (
                  <div key={state.label} className="flex items-center gap-3">
                    <span className={state.active ? "h-2.5 w-2.5 rounded-full bg-emerald-700" : "h-2.5 w-2.5 rounded-full bg-slate-300"} />
                    <span>{index + 1}. {state.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-950">Current step:</span> {getNextStep(booking.payment_status, booking.booking_status)}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-xl font-bold">Recurring plan</h2>
              {booking.recurringSeries ? (
                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <SummaryRow label="Frequency" value={slugToTitle(booking.recurringSeries.frequency)} />
                  <SummaryRow label="Generated visits" value={String(booking.recurringSeries.occurrence_count)} />
                  <SummaryRow label="This visit" value={`${booking.occurrence_index ?? 1} of ${booking.occurrence_count ?? booking.recurringSeries.occurrence_count}`} />
                  <SummaryRow label="Per-visit amount" value={formatZar(getPerVisitAmount(booking))} />
                  <SummaryRow label="Series amount" value={formatZar(getPaymentAmount(booking))} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">This is a once-off Regular Cleaning booking.</p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-xl font-bold">Payment record</h2>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <SummaryRow label="Provider" value={booking.payment?.provider ?? "Paystack"} />
                <SummaryRow label="Reference" value={booking.payment?.provider_reference ?? booking.payment?.provider_ref ?? "Not initialized"} />
                <SummaryRow label="Payment status" value={slugToTitle(booking.payment?.status ?? booking.payment_status)} />
                <SummaryRow label={booking.recurringSeries ? "Amount charged" : "Amount"} value={formatZar(getPaymentAmount(booking))} />
              </div>
            </Card>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function SummaryRow({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" href={href}>
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700" href={href}>
      {children}
    </Link>
  );
}

function DashboardShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <>
      <DashboardHeader active="customer" />
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
          <div className="mt-8 space-y-5">{children}</div>
        </div>
      </main>
    </>
  );
}

function getParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatAddons(addons: Array<{ label: string }>) {
  return addons.length > 0 ? addons.map((addon) => addon.label).join(", ") : "No add-ons selected";
}

function formatCleaner(booking: { selectedCleaner: { display_name: string | null; full_name: string | null } | null; booking_status?: string }) {
  if (!booking.selectedCleaner) {
    return "Auto-assignment fallback enabled.";
  }

  const cleanerName = booking.selectedCleaner.display_name ?? booking.selectedCleaner.full_name ?? "Preferred cleaner";
  return ["assigned", "in_progress", "completed"].includes(booking.booking_status ?? "")
    ? `${cleanerName} accepted and assigned.`
    : `${cleanerName} selected.`;
}

function formatAssignment(booking: {
  selectedCleaner: { display_name: string | null; full_name: string | null } | null;
  booking_status: string;
}) {
  if (!booking.selectedCleaner) {
    return "Auto-assignment pending";
  }

  const cleanerName = booking.selectedCleaner.display_name ?? booking.selectedCleaner.full_name ?? "Cleaner";
  return ["assigned", "in_progress", "completed"].includes(booking.booking_status)
    ? `${cleanerName} accepted`
    : `${cleanerName} requested`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatTimeWindow(timeWindow: string) {
  return timeWindow.replace("-", " - ");
}

function getPerVisitAmount(booking: {
  per_occurrence_total_cents: number | null;
  final_total_cents: number;
}) {
  return booking.per_occurrence_total_cents ?? booking.final_total_cents;
}

function getPaymentAmount(booking: {
  payment: { amount_cents: number } | null;
  series_total_cents: number | null;
  final_total_cents: number;
}) {
  return booking.payment?.amount_cents ?? booking.series_total_cents ?? booking.final_total_cents;
}

function getNextStep(paymentStatus: string, bookingStatus: string) {
  if (paymentStatus !== "paid") return "Awaiting payment";
  if (bookingStatus === "confirmed") return "Cleaner assignment";
  if (bookingStatus === "assigned") return "Cleaner assigned";
  if (bookingStatus === "in_progress") return "Cleaning in progress";
  if (bookingStatus === "completed") return "Completed";
  if (bookingStatus === "cancelled") return "Cancelled";
  return slugToTitle(bookingStatus);
}

function buildTrackingSteps(paymentStatus: string, bookingStatus: string) {
  return [
    { label: paymentStatus === "paid" ? "Paid" : "Payment pending", active: ["paid"].includes(paymentStatus) },
    { label: "Booking confirmed", active: ["confirmed", "assigned", "in_progress", "completed"].includes(bookingStatus) },
    { label: "Cleaner assignment", active: ["assigned", "in_progress", "completed"].includes(bookingStatus) },
    { label: "In progress", active: ["in_progress", "completed"].includes(bookingStatus) },
    { label: "Completed", active: bookingStatus === "completed" },
  ];
}
