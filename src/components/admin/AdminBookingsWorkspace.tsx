"use client";

import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AdminBookingCreateDrawer } from "@/components/admin/AdminBookingCreateDrawer";
import { AdminBookingDetailDrawer } from "@/components/admin/AdminBookingDetailDrawer";
import { AdminBookingsDataGrid } from "@/components/admin/AdminBookingsDataGrid";
import { AdminBookingsOperationsSummary } from "@/components/admin/AdminBookingsOperationsSummary";
import { ADMIN_PAGE_DESCRIPTION_CLASS, ADMIN_PAGE_TITLE_CLASS } from "@/components/admin/admin-page-styles";
import { createAdminBookingAction } from "@/lib/admin/actions";
import type { BookingsOperationsMetrics } from "@/lib/admin/bookings-ui";
import type {
  AddonRow,
  AdminBookingListItem,
  CleanerRow,
  CustomerRow,
  EquipmentRow,
} from "@/lib/admin/data";

export function AdminBookingsWorkspace({
  bookings,
  cleaners,
  customers,
  addons,
  equipmentOptions,
  hasActivePricingRules,
  metrics,
  adminCreatedBookingIds,
  banners,
}: {
  bookings: AdminBookingListItem[];
  cleaners: CleanerRow[];
  customers: CustomerRow[];
  addons: AddonRow[];
  equipmentOptions: EquipmentRow[];
  hasActivePricingRules: boolean;
  metrics: BookingsOperationsMetrics;
  adminCreatedBookingIds: string[];
  banners: React.ReactNode;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<AdminBookingListItem | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "needs_action" | "upcoming" | "completed" | "cancelled">("all");

  const adminIds = useMemo(() => new Set(adminCreatedBookingIds), [adminCreatedBookingIds]);

  const openNeedsAction = useCallback(() => {
    setActiveTab("needs_action");
    document.getElementById("bookings-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Operations</p>
          <h1 className={`mt-2 ${ADMIN_PAGE_TITLE_CLASS}`}>Bookings and assignment</h1>
          <p className={ADMIN_PAGE_DESCRIPTION_CLASS}>
            Manage customer bookings, payments, invoices, and cleaner assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          Create booking
        </button>
      </header>

      <AdminBookingsOperationsSummary metrics={metrics} onPendingAssignmentClick={openNeedsAction} />

      {banners}

      <div id="bookings-table">
        <AdminBookingsDataGrid
          bookings={bookings}
          cleaners={cleaners}
          adminCreatedBookingIds={adminIds}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onViewBooking={setDetailBooking}
        />
      </div>

      <AdminBookingCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        action={createAdminBookingAction}
        customers={customers}
        cleaners={cleaners}
        addons={addons}
        equipmentOptions={equipmentOptions}
        hasActivePricingRules={hasActivePricingRules}
      />

      <AdminBookingDetailDrawer
        booking={detailBooking}
        cleaners={cleaners}
        adminCreatedBookingIds={adminIds}
        open={detailBooking != null}
        onClose={() => setDetailBooking(null)}
      />
    </div>
  );
}
