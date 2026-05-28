import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CleanerDashboardJob } from "@/lib/dashboard/data";

type CleanerJobSectionProps = {
  title: string;
  description: string;
  empty: string;
  jobs: CleanerDashboardJob[];
  render: (job: CleanerDashboardJob) => ReactNode;
};

export function CleanerJobSection({ title, description, empty, jobs, render }: CleanerJobSectionProps) {
  return (
    <section className="scroll-mt-24">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-black text-slate-950 sm:text-xl">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <Badge className="w-fit">{jobs.length}</Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:gap-4">
        {jobs.length > 0 ? jobs.map(render) : (
          <Card className="p-4 text-sm text-slate-600 sm:p-5">{empty}</Card>
        )}
      </div>
    </section>
  );
}
