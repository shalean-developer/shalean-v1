 "use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Briefcase,
  CheckCircle2,
  CircleHelp,
  Clock,
  MapPin,
  Play,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CleanerDashboardJob } from "@/lib/dashboard/data";
import {
  buildMapsUrl,
  formatAddons,
  formatDate,
  formatHours,
  formatTimeWindow,
  statusBadgeClass,
  statusLabel,
} from "@/lib/cleaner/portal";
import { cn, formatZar, slugToTitle } from "@/lib/utils";
import {
  acceptOfferAction,
  completeJobAction,
  declineOfferAction,
  startJobAction,
} from "../actions";

type JobMode = "offer" | "accepted" | "in_progress" | "completed";

type CleanerJobsByCategory = {
  offers: CleanerDashboardJob[];
  upcomingJobs: CleanerDashboardJob[];
  inProgressJobs: CleanerDashboardJob[];
  completedJobs: CleanerDashboardJob[];
};

export function CleanerQuickStats({
  jobs,
  todaysEarningsCents,
}: {
  jobs: CleanerJobsByCategory;
  todaysEarningsCents: number;
}) {
  const activeCount = jobs.upcomingJobs.length + jobs.inProgressJobs.length;

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard icon={<Wallet className="h-4 w-4" />} label="Today earnings" value={formatZar(todaysEarningsCents)} />
      <StatCard icon={<Briefcase className="h-4 w-4" />} label="Offers" value={String(jobs.offers.length)} />
      <StatCard icon={<Clock className="h-4 w-4" />} label="Active jobs" value={String(activeCount)} />
      <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={String(jobs.completedJobs.length)} />
    </section>
  );
}

type JobTabConfig = {
  id: "offers" | "upcoming" | "inProgress" | "completed";
  title: string;
  tooltip: string;
  empty: string;
  jobs: CleanerDashboardJob[];
  mode: JobMode;
};

export function CleanerJobTabs({ jobs }: { jobs: CleanerJobsByCategory }) {
  const tabs = useMemo<JobTabConfig[]>(
    () => [
      {
        id: "offers",
        title: "Offers",
        tooltip: "Accept jobs that fit your schedule. Full addresses unlock once accepted.",
        empty: "No new Regular Cleaning offers right now.",
        jobs: jobs.offers,
        mode: "offer",
      },
      {
        id: "upcoming",
        title: "Upcoming",
        tooltip: "Confirmed jobs you can prepare for and start.",
        empty: "No accepted upcoming jobs yet.",
        jobs: jobs.upcomingJobs,
        mode: "accepted",
      },
      {
        id: "inProgress",
        title: "In Progress",
        tooltip: "Jobs already started and waiting for completion.",
        empty: "No jobs are currently in progress.",
        jobs: jobs.inProgressJobs,
        mode: "in_progress",
      },
      {
        id: "completed",
        title: "Completed",
        tooltip: "Recently completed jobs and payout-ready work.",
        empty: "Completed jobs will appear here.",
        jobs: jobs.completedJobs,
        mode: "completed",
      },
    ],
    [jobs.completedJobs, jobs.inProgressJobs, jobs.offers, jobs.upcomingJobs],
  );
  const [activeTab, setActiveTab] = useState<JobTabConfig["id"]>("offers");
  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((tab) => {
            const isActive = tab.id === selectedTab.id;
            return (
              <button
                key={tab.id}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                    : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50",
                )}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <span>{tab.title}</span>
                <Badge
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700",
                  )}
                >
                  {tab.jobs.length}
                </Badge>
                <span
                  aria-label={`${tab.title}: ${tab.tooltip}`}
                  className={cn("inline-flex items-center", isActive ? "text-white/85" : "text-slate-500")}
                  title={tab.tooltip}
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <JobSection empty={selectedTab.empty} jobs={selectedTab.jobs} mode={selectedTab.mode} title={selectedTab.title} />
    </section>
  );
}

export function JobSection({
  title,
  empty,
  jobs,
  mode,
  className,
}: {
  title: string;
  empty: string;
  jobs: CleanerDashboardJob[];
  mode: JobMode;
  className?: string;
}) {
  return (
    <section className={cn("h-full", className)}>
      <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-base font-black text-slate-950 sm:text-lg">{title}</h2>
        </div>
        <Badge className="w-fit">{jobs.length}</Badge>
      </div>
      <div className="mt-2 grid gap-2">
        {jobs.length > 0 ? jobs.map((job) => <CleanerJobCard key={job.offer.id} job={job} mode={mode} />) : (
          <Card className="p-3 text-sm text-slate-600">{empty}</Card>
        )}
      </div>
    </section>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3 sm:p-3.5">
      <div className="flex items-center gap-1.5 text-emerald-700">{icon}</div>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-black text-slate-950 sm:text-xl">{value}</p>
    </Card>
  );
}

function CleanerJobCard({ job, mode }: { job: CleanerDashboardJob; mode: JobMode }) {
  const booking = job.booking;
  const navigationUrl = job.safeAddress ? buildMapsUrl(job.safeAddress, booking.suburb) : null;

  return (
    <Card className="p-3 sm:p-3.5">
      <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold text-slate-950 sm:text-base">{slugToTitle(booking.service_slug)}</h3>
            <Badge className={statusBadgeClass(mode)}>{statusLabel(mode)}</Badge>
            {job.offer.is_preferred ? <Badge>Preferred</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {formatDate(booking.booking_date)}, {formatTimeWindow(booking.booking_time)} in {booking.suburb}
          </p>
          {job.safeAddress ? (
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-800">
              <MapPin className="h-4 w-4 text-emerald-700" />
              {job.safeAddress}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Full address unlocks after acceptance.</p>
          )}
        </div>
        <div className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-left sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900">Your earning</p>
          <p className="text-base font-black text-emerald-800 sm:text-lg">{formatZar(job.offer.earning_cents ?? 0)}</p>
        </div>
      </div>

      <div className="mt-2.5 grid gap-1.5 rounded-md bg-slate-50 p-2.5 text-xs text-slate-600 sm:grid-cols-2 sm:text-sm">
        <Detail label="Bedrooms" value={String(booking.bedrooms)} />
        <Detail label="Bathrooms" value={String(booking.bathrooms)} />
        <Detail label="Extra rooms" value={String(booking.extra_rooms)} />
        <Detail label="Add-ons" value={formatAddons(booking.addons)} />
        <Detail label="Equipment" value={booking.equipment?.label ?? "Without Equipment"} />
        <Detail label="Cleaner count" value={`${booking.cleaner_count} cleaner${booking.cleaner_count === 1 ? "" : "s"}`} />
        <Detail label="Estimated hours" value={formatHours(booking.estimated_minutes)} />
        <Detail
          label="Recurring"
          value={booking.recurringSeries ? `${slugToTitle(booking.recurringSeries.frequency)}, ${booking.recurringSeries.occurrence_count} visits` : "No"}
        />
      </div>

      {booking.customer_notes ? (
        <div className="mt-2.5 rounded-md border border-slate-200 p-2.5 text-sm text-slate-600">
          <strong className="text-slate-950">Customer notes:</strong> {booking.customer_notes}
        </div>
      ) : null}

      {job.safeNotes ? (
        <div className="mt-2.5 rounded-md border border-slate-200 p-2.5 text-sm text-slate-600">
          <strong className="text-slate-950">Access notes:</strong> {job.safeNotes}
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {mode === "offer" ? (
          <>
            <form action={acceptOfferAction}>
              <HiddenOfferFields job={job} />
              <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white" type="submit">
                Accept
              </button>
            </form>
            <form action={declineOfferAction}>
              <HiddenOfferFields job={job} />
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700" type="submit">
                Decline
              </button>
            </form>
          </>
        ) : null}

        {navigationUrl ? (
          <a
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700"
            href={navigationUrl}
            rel="noreferrer"
            target="_blank"
          >
            <MapPin className="h-4 w-4" />
            Navigate
          </a>
        ) : null}

        {mode === "accepted" ? (
          <form action={startJobAction}>
            <HiddenOfferFields job={job} />
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-1.5 text-sm font-bold text-white" type="submit">
              <Play className="h-4 w-4" />
              Start job
            </button>
          </form>
        ) : null}

        {mode === "in_progress" ? (
          <form action={completeJobAction}>
            <HiddenOfferFields job={job} />
            <button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white" type="submit">
              <CheckCircle2 className="h-4 w-4" />
              Complete job
            </button>
          </form>
        ) : null}

        {mode === "completed" ? (
          <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600">
            <RotateCcw className="h-4 w-4" />
            Ready for payout review
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function HiddenOfferFields({ job }: { job: CleanerDashboardJob }) {
  return <input name="offerId" type="hidden" value={job.offer.id} />;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <strong className="text-slate-950">{label}:</strong> {value}
    </span>
  );
}
