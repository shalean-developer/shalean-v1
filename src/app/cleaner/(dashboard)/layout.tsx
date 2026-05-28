import type { ReactNode } from "react";
import { CleanerShell } from "@/components/cleaner/CleanerShell";
import { requireCleanerSession } from "@/lib/auth/server";
import { getCleanerName } from "@/lib/cleaner/format";
import { loadCleanerDashboard } from "@/lib/dashboard/data";

export default async function CleanerDashboardLayout({ children }: { children: ReactNode }) {
  const { cleaner } = await requireCleanerSession();
  const dashboard = await loadCleanerDashboard({ cleanerId: cleaner.id });

  if (!dashboard.selectedCleaner || !dashboard.profile) {
    return <>{children}</>;
  }

  return (
    <CleanerShell
      cleanerName={getCleanerName(dashboard.selectedCleaner)}
      photoUrl={dashboard.selectedCleaner.photo_url}
      available={dashboard.selectedCleaner.available}
      offerCount={dashboard.offers.length}
      activeJobCount={dashboard.activeJobs.length}
    >
      {children}
    </CleanerShell>
  );
}
