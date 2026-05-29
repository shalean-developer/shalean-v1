import type { Metadata } from "next";
import type React from "react";
import { Card } from "@/components/ui/card";
import { BookingDetailView } from "@/components/dashboard/BookingDetailView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { requireCustomer } from "@/lib/auth/server";
import { loadCustomerBookingDetail } from "@/lib/dashboard/data";
import { reconcilePaystackPayment } from "@/lib/payments/reconciliation";

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
  const payStatus = getParam(params, "pay");
  let reconciliationMessage: string | null = null;

  if (payStatus === "already") {
    reconciliationMessage = "This booking is already paid.";
  } else if (payStatus === "error") {
    reconciliationMessage = "We couldn't start the payment just now. Please try again, or contact support.";
  }

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

  const { booking } = await loadCustomerBookingDetail({
    bookingId,
    customerAuthUserId: user.id,
    customerEmail: user.email,
  });

  return (
    <DashboardShell title="Booking details" eyebrow="Customer booking">
      {!booking ? (
        <Card className="p-6">
          <h2 className="text-xl font-bold">No booking found</h2>
          <p className="mt-2 text-sm text-slate-600">Your Regular Cleaning bookings will appear after checkout starts.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" href="/bookings">All bookings</a>
            <a className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700" href="/book?new=1">Start new booking</a>
          </div>
        </Card>
      ) : (
        <BookingDetailView booking={booking} reconciliationMessage={reconciliationMessage} />
      )}
    </DashboardShell>
  );
}

function DashboardShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <>
      <DashboardHeader active="dashboard" />
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
