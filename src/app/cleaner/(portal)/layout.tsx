import type { ReactNode } from "react";
import { CleanerPortalShell } from "@/components/cleaner/CleanerPortalShell";
import { fallbackCleanerPhoto, getCleanerName } from "@/lib/cleaner/portal";
import { getCleanerPortalData } from "./_lib/portal-data";

export const dynamic = "force-dynamic";

export default async function ProtectedCleanerLayout({ children }: { children: ReactNode }) {
  const { dashboard, availability } = await getCleanerPortalData();
  const selectedCleaner = dashboard.selectedCleaner;
  const cleanerName = getCleanerName(selectedCleaner);

  return (
    <CleanerPortalShell
      availabilityBadgeClass={availability.badgeClass}
      availabilityLabel={availability.label}
      cleanerName={cleanerName}
      cleanerPhotoUrl={selectedCleaner.photo_url ?? fallbackCleanerPhoto}
    >
      {children}
    </CleanerPortalShell>
  );
}
