import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCleanerName } from "@/lib/cleaner/portal";
import { CleanerQuickStats, JobSection } from "./_components/CleanerJobs";
import { getCleanerPortalData } from "./_lib/portal-data";

export const metadata: Metadata = {
  title: "Cleaner Dashboard | Shalean",
};

export default async function CleanerDashboardPage() {
  const { dashboard, availability, readiness } = await getCleanerPortalData();
  const cleanerName = getCleanerName(dashboard.selectedCleaner);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section>
        <Badge>Dashboard</Badge>
        <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Welcome back, {cleanerName}</h2>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-600 sm:text-base">
          Manage new offers, active jobs, and completed bookings in one place.
        </p>
      </section>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-700">Status: {availability.label}</p>
        <p className="mt-1 text-sm text-slate-600">{availability.description}</p>
      </Card>

      <CleanerQuickStats
        jobs={{
          offers: dashboard.offers,
          upcomingJobs: dashboard.upcomingJobs,
          inProgressJobs: dashboard.inProgressJobs,
          completedJobs: dashboard.completedJobs,
        }}
        todaysEarningsCents={dashboard.todaysEarningsCents}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="grid gap-4">
          <JobSection
            description="Accept jobs that fit your schedule. Full addresses unlock once accepted."
            empty="No new Regular Cleaning offers right now."
            jobs={dashboard.offers}
            mode="offer"
            title="Offers"
          />
          <JobSection
            description="Confirmed jobs you can prepare for and start."
            empty="No accepted upcoming jobs yet."
            jobs={dashboard.upcomingJobs}
            mode="accepted"
            title="Upcoming jobs"
          />
          <JobSection
            description="Jobs already started and waiting for completion."
            empty="No jobs are currently in progress."
            jobs={dashboard.inProgressJobs}
            mode="in_progress"
            title="In progress jobs"
          />
          <JobSection
            description="Recently completed jobs and payout-ready work."
            empty="Completed jobs will appear here."
            jobs={dashboard.completedJobs}
            mode="completed"
            title="Completed jobs"
          />
        </section>

        <aside className="grid content-start gap-3">
          <Card className="p-4">
            <h3 className="text-base font-bold text-slate-950">Cleaner readiness</h3>
            <p className="mt-1 text-sm text-slate-600">Your account and operational readiness snapshot.</p>
            <div className="mt-3 space-y-2 text-sm">
              {readiness.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">{item.label}</span>
                  <Badge>{item.value}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
