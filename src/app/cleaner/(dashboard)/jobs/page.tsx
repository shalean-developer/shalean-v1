import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { CleanerJobCard } from "@/components/cleaner/CleanerJobCard";
import { CleanerJobSection } from "@/components/cleaner/CleanerJobSection";
import { requireCleanerSession } from "@/lib/auth/server";
import { loadCleanerDashboard, type CleanerDashboardJob } from "@/lib/dashboard/data";

export const metadata: Metadata = {
  title: "Cleaner Jobs | Shalean",
};

export const dynamic = "force-dynamic";

export default async function CleanerJobsPage() {
  const { cleaner } = await requireCleanerSession();
  const dashboard = await loadCleanerDashboard({ cleanerId: cleaner.id });

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8 lg:space-y-6 lg:pt-4">
      <header>
        <Badge>Jobs</Badge>
        <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Jobs / Schedule</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Accepted jobs, active work, completed jobs, and job history.
        </p>
      </header>

      <CleanerJobSection
        title="Accepted / upcoming"
        description="Confirmed jobs to prepare for. Future accepted jobs appear here instead of Home."
        empty="No accepted upcoming jobs yet."
        jobs={dashboard.acceptedJobs}
        render={(job) => <AnchoredJobCard key={job.offer.id} job={job} mode="accepted" />}
      />

      <CleanerJobSection
        title="Active jobs"
        description="Jobs already started and waiting to be completed."
        empty="No jobs are currently in progress."
        jobs={dashboard.inProgressJobs}
        render={(job) => <AnchoredJobCard key={job.offer.id} job={job} mode="in_progress" />}
      />

      <CleanerJobSection
        title="Completed / history"
        description="Recently completed Regular Cleaning jobs."
        empty="Completed jobs will appear here."
        jobs={dashboard.completedJobs}
        render={(job) => <AnchoredJobCard key={job.offer.id} job={job} mode="completed" />}
      />
    </div>
  );
}

function AnchoredJobCard({
  job,
  mode,
}: {
  job: CleanerDashboardJob;
  mode: "accepted" | "in_progress" | "completed";
}) {
  return (
    <div id={`job-${job.offer.id}`} className="scroll-mt-24">
      <CleanerJobCard job={job} mode={mode} />
    </div>
  );
}
