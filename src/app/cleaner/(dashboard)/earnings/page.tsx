import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CleanerEarningsSummary } from "@/components/cleaner/CleanerEarningsSummary";
import { requireCleanerSession } from "@/lib/auth/server";
import { loadCleanerDashboard } from "@/lib/dashboard/data";

export const metadata: Metadata = {
  title: "Cleaner Earnings | Shalean",
};

export const dynamic = "force-dynamic";

export default async function CleanerEarningsPage() {
  const { cleaner } = await requireCleanerSession();
  const dashboard = await loadCleanerDashboard({ cleanerId: cleaner.id });

  if (!dashboard.profile || !dashboard.selectedCleaner) {
    redirect("/cleaner");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8 lg:space-y-6 lg:pt-4">
      <header>
        <Badge>Earnings</Badge>
        <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Earnings</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Track today, this week, and pending payouts from your Regular Cleaning jobs.
        </p>
      </header>

      <CleanerEarningsSummary earnings={dashboard.earnings} />
    </div>
  );
}
