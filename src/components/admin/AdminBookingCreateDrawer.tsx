"use client";

import { AdminBookingWizardCard } from "@/components/admin/AdminBookingWizardCard";
import { AdminDrawer } from "@/components/admin/AdminDrawer";
import type { AddonRow, CleanerRow, CustomerRow, EquipmentRow } from "@/lib/admin/data";

export function AdminBookingCreateDrawer({
  open,
  onClose,
  action,
  customers,
  cleaners,
  addons,
  equipmentOptions,
  hasActivePricingRules,
}: {
  open: boolean;
  onClose: () => void;
  action: (formData: FormData) => void | Promise<void>;
  customers: CustomerRow[];
  cleaners: CleanerRow[];
  addons: AddonRow[];
  equipmentOptions: EquipmentRow[];
  hasActivePricingRules: boolean;
}) {
  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title="Create booking"
      description="Admin-assisted booking wizard — same steps and server actions as before."
      width="max-w-2xl"
    >
      <AdminBookingWizardCard
        action={action}
        customers={customers}
        cleaners={cleaners}
        addons={addons}
        equipmentOptions={equipmentOptions}
        hasActivePricingRules={hasActivePricingRules}
        embedded
      />
    </AdminDrawer>
  );
}
