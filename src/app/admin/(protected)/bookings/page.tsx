import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { AdminBookingCard } from "@/components/admin/AdminControls";
import { Card } from "@/components/ui/card";
import { loadAdminBookings, loadAdminManagementData } from "@/lib/admin/data";
import { formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin Bookings | Shalean",
};

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const [management, bookings] = await Promise.all([
    loadAdminManagementData(),
    loadAdminBookings(100),
  ]);

  return (
    <>
      <AdminPageHeading eyebrow="Booking section" title="Bookings and assignment">
        Create bookings for existing customers and review bookings created from both customer checkout and admin-assisted flows.
      </AdminPageHeading>
      <section className="space-y-4">
        <AdminBookingCard
          customers={management.customers}
          cleaners={management.cleaners}
          addons={management.addons}
          equipmentOptions={management.equipmentOptions}
        />
        <Card className="border-white/10 bg-white p-5 text-slate-950">
          <h2 className="text-xl font-bold">Recent bookings</h2>
          <p className="mt-1 text-sm text-slate-600">
            Includes bookings created through customer checkout and admin booking creation.
          </p>
          <div className="mt-4 grid gap-3">
            {bookings.length > 0 ? bookings.map((booking) => (
              <div
                key={booking.id}
                className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-slate-950">{booking.customer?.full_name ?? "Customer unavailable"}</p>
                  <p className="mt-1 text-slate-600">{booking.address}, {booking.suburb}</p>
                  <p className="mt-1 text-slate-600">
                    {booking.booking_date} {booking.booking_time}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{slugToTitle(booking.service_slug)}</p>
                  <p className="mt-1 text-slate-600">{booking.cleaner_count} cleaner{booking.cleaner_count === 1 ? "" : "s"}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{formatZar(booking.final_total_cents)}</p>
                  <p className="mt-1 text-slate-600">{booking.payment ? slugToTitle(booking.payment.status) : slugToTitle(booking.payment_status)}</p>
                </div>
                <div className="justify-self-start rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {slugToTitle(booking.booking_status)}
                </div>
              </div>
            )) : <p className="text-sm text-slate-600">No bookings found.</p>}
          </div>
        </Card>
      </section>
    </>
  );
}
