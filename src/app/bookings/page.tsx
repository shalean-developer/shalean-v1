import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { requireCustomer } from "@/lib/auth/server";
import { loadCustomerBookingsList } from "@/lib/dashboard/data";
import { formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bookings | Shalean",
};

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const { user } = await requireCustomer();
  const { items } = await loadCustomerBookingsList({
    customerAuthUserId: user.id,
    customerEmail: user.email,
  });

  return (
    <>
      <DashboardHeader active="customer" />
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Bookings</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Your Shalean bookings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Track paid bookings, recurring services, cleaner assignment, and payment records.
            </p>
          </div>
          <Link className="inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" href="/book?new=1">
            Start new booking
          </Link>
        </div>

        {items.length === 0 ? (
          <Card className="mt-8 p-6">
            <h2 className="text-xl font-bold">No bookings yet</h2>
            <p className="mt-2 text-sm text-slate-600">Your Regular Cleaning bookings will appear here after checkout starts.</p>
            <Link className="mt-4 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" href="/book?new=1">
              Start new booking
            </Link>
          </Card>
        ) : (
          <div className="mt-8 grid gap-4">
            {items.map((item) => (
              <Card key={item.key} className="p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{slugToTitle(item.paymentStatus)}</Badge>
                      <Badge className="border-slate-200 bg-slate-50 text-slate-700">{slugToTitle(item.bookingStatus)}</Badge>
                      {item.isRecurring ? <Badge>Recurring series</Badge> : null}
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-slate-950">
                      {slugToTitle(item.detailBooking.service_slug)} in {item.nextBooking.suburb}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Next visit: {formatDate(item.nextBooking.booking_date)}, {formatTimeWindow(item.nextBooking.booking_time)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.isRecurring
                        ? `${item.visitCount} visits grouped into one recurring plan`
                        : "Once-off booking"}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                    <ListStat label="Per visit" value={formatZar(item.perVisitTotalCents)} />
                    <ListStat label={item.isRecurring ? "Series total" : "Total"} value={formatZar(item.totalPaidCents)} />
                    <Link
                      className="inline-flex min-h-16 items-center justify-center rounded-md bg-emerald-700 px-4 py-3 text-sm font-bold text-white"
                      href={`/dashboard?booking=${item.detailBooking.id}`}
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        </div>
      </main>
    </>
  );
}

function ListStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
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
