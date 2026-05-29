"use client";

import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AdminBookingCreateDrawer } from "@/components/admin/AdminBookingCreateDrawer";
import { AdminBookingDetailDrawer } from "@/components/admin/AdminBookingDetailDrawer";
import { AdminBookingsActionCards } from "@/components/admin/AdminBookingsActionCards";
import { AdminBookingsDataGrid } from "@/components/admin/AdminBookingsDataGrid";
import { AdminPageOverviewHeader } from "@/components/admin/AdminPageOverviewHeader";
import { createAdminBookingAction } from "@/lib/admin/actions";
import type { BookingsActionFilter, BookingsActionMetrics, BookingsTab } from "@/lib/admin/bookings-ui";
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
  metrics: BookingsActionMetrics;
  adminCreatedBookingIds: string[];
  banners: React.ReactNode;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<AdminBookingListItem | null>(null);
  const [activeTab, setActiveTab] = useState<BookingsTab>("all");
  const [actionFilter, setActionFilter] = useState<BookingsActionFilter | null>(null);

  const adminIds = useMemo(() => new Set(adminCreatedBookingIds), [adminCreatedBookingIds]);

  const scrollToTable = useCallback(() => {
    document.getElementById("bookings-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleActionFilterSelect = useCallback(
    (filter: BookingsActionFilter) => {
      setActionFilter((current) => {
        const next = current === filter ? null : filter;
        if (next === "needs_action") {
          setActiveTab("needs_action");
        } else if (current === "needs_action" || (next === null && filter === "needs_action")) {
          setActiveTab("all");
        } else if (next !== null && activeTab === "needs_action") {
          setActiveTab("all");
        }
        return next;
      });
      scrollToTable();
    },
    [activeTab, scrollToTable],
  );

  const handleTabChange = useCallback((tab: BookingsTab) => {
    setActiveTab(tab);
    if (tab !== "needs_action") {
      setActionFilter((current) => (current === "needs_action" ? null : current));
    }
  }, []);

  const handleActionFilterClear = useCallback(() => {
    setActionFilter(null);
  }, []);

  return (
    <div className="space-y-4">
      <AdminPageOverviewHeader
        title="Booking operations"
        description="Review bookings that need assignment, payment follow-up, invoices, or Zoho sync — then act in the table below."
        action={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-fit shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-emerald-700 bg-white px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
          >
            <Plus className="h-4 w-4" />
            Create booking
          </button>
        }
      />

      <AdminBookingsActionCards
        metrics={metrics}
        activeFilter={actionFilter}
        onFilterSelect={handleActionFilterSelect}
      />

      {banners}

      <div id="bookings-table">
        <AdminBookingsDataGrid
          bookings={bookings}
          cleaners={cleaners}
          adminCreatedBookingIds={adminIds}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          actionFilter={actionFilter}
          onActionFilterClear={handleActionFilterClear}
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
