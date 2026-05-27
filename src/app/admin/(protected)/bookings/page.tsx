import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { AdminBookingCard } from "@/components/admin/AdminControls";
import { loadAdminManagementData } from "@/lib/admin/data";

export const metadata: Metadata = {
  title: "Admin Bookings | Shalean",
};

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const management = await loadAdminManagementData();

  return (
    <>
      <AdminPageHeading eyebrow="Booking section" title="Bookings and assignment">
        Create bookings for existing customers while keeping the existing Regular Cleaning booking flow intact.
      </AdminPageHeading>
      <section>
        <AdminBookingCard
          customers={management.customers}
          cleaners={management.cleaners}
          addons={management.addons}
          equipmentOptions={management.equipmentOptions}
        />
      </section>
    </>
  );
}
