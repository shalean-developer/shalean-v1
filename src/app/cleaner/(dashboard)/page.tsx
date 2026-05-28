import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Briefcase, CalendarDays, Clock, Gift, MapPin, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptOfferAction, declineOfferAction, startJobAction, toggleAvailabilityAction } from "@/lib/cleaner/actions";
import {
  formatBookingDate,
  formatEstimatedHours,
  formatTimeWindow,
  lifecycleStatusBadgeClass,
  lifecycleStatusLabel,
} from "@/lib/cleaner/format";
import { requireCleanerSession } from "@/lib/auth/server";
import { loadCleanerDashboard, type CleanerDashboardJob } from "@/lib/dashboard/data";
import { formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cleaner Dashboard | Shalean",
};

export const dynamic = "force-dynamic";

export default async function CleanerDashboardPage() {
  const { cleaner } = await requireCleanerSession();
  const dashboard = await loadCleanerDashboard({ cleanerId: cleaner.id });

  if (!dashboard.selectedCleaner || !dashboard.profile) {
    return (
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <Badge>Cleaner portal</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">Cleaner dashboard</h1>
        <Card className="mt-6 p-5 sm:mt-8 sm:p-6">
          <h2 className="text-lg font-bold sm:text-xl">No active cleaner profile found</h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Contact Shalean support if your Regular Cleaning cleaner account should be active.
          </p>
        </Card>
      </div>
    );
  }

  const availableJobs = dashboard.offers;
  const todayJobs = dashboard.todayJobs;
  const available = dashboard.profile.available;
  const firstName = dashboard.profile.name.split(" ")[0] || dashboard.profile.name;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8 lg:space-y-6 lg:pt-4">
      <header className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-3.5">
        <h1 className="text-lg font-black leading-tight text-slate-950 sm:text-xl">
          Hi, {firstName}
        </h1>
        <p className="mt-0.5 text-sm font-semibold">
          <span className={available ? "text-emerald-700" : "text-amber-700"}>
            {available ? "Online" : "Offline"}
          </span>
          <span className="text-slate-400"> • </span>
          <span className="text-slate-600">
            {available ? "Ready for offers" : "Not receiving offers"}
          </span>
        </p>
      </header>

      {todayJobs.length > 0 ? (
        <section aria-labelledby="todays-job-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="todays-job-title" className="text-xl font-black text-slate-950 sm:text-2xl">
              Today&apos;s job
            </h2>
            <Badge className="border-slate-200 bg-white text-slate-700">{todayJobs.length}</Badge>
          </div>
          <div className="grid gap-4">
            {todayJobs.map((job) => (
              <TodayJobCard key={job.offer.id} job={job} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="available-jobs-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="available-jobs-title" className="text-xl font-black text-slate-950 sm:text-2xl">
            Available Jobs
          </h2>
          <Badge className="border-slate-200 bg-white text-slate-700">{availableJobs.length}</Badge>
        </div>

        {availableJobs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {availableJobs.map((job) => (
              <AvailableJobCard key={job.offer.id} job={job} />
            ))}
          </div>
        ) : todayJobs.length > 0 ? (
          <SmallAvailableJobsEmpty />
        ) : (
          <EmptyAvailableJobs available={dashboard.profile.available} />
        )}
      </section>
    </div>
  );
}

function AvailableJobCard({ job }: { job: CleanerDashboardJob }) {
  const booking = job.booking;
  const estimatedDuration = formatEstimatedHours(booking.estimated_minutes);
  const estimatedPay = job.offer.earning_cents ? formatZar(job.offer.earning_cents) : null;

  return (
    <Card className="flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-950">{slugToTitle(booking.service_slug)}</h3>
          <Badge className="mt-2 border-emerald-200 bg-emerald-50 text-emerald-800">Available</Badge>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <Gift className="h-5 w-5" />
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-slate-600">
        <JobFact
          icon={<CalendarDays className="h-4 w-4" />}
          label="Date and time"
          value={`${formatBookingDate(booking.booking_date)} at ${formatTimeWindow(booking.booking_time)}`}
        />
        <JobFact icon={<MapPin className="h-4 w-4" />} label="Area" value={booking.suburb} />
        {booking.estimated_minutes ? (
          <JobFact icon={<Clock className="h-4 w-4" />} label="Estimated duration" value={estimatedDuration} />
        ) : null}
        {estimatedPay ? <JobFact label="Estimated pay" value={estimatedPay} strong /> : null}
        <JobFact label="Job status" value="Available" />
      </dl>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <details className="group sm:col-span-2">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-black text-slate-950 hover:bg-slate-50">
            View details
          </summary>
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p>
              <strong className="text-slate-950">Service:</strong> {slugToTitle(booking.service_slug)}
            </p>
            <p className="mt-1">
              <strong className="text-slate-950">Area:</strong> {booking.suburb}
            </p>
            {booking.estimated_minutes ? (
              <p className="mt-1">
                <strong className="text-slate-950">Duration:</strong> {estimatedDuration}
              </p>
            ) : null}
            {estimatedPay ? (
              <p className="mt-1">
                <strong className="text-slate-950">Pay:</strong> {estimatedPay}
              </p>
            ) : null}
          </div>
        </details>
        <form action={acceptOfferAction}>
          <input type="hidden" name="offerId" value={job.offer.id} />
          <Button className="w-full" type="submit">
            Accept
          </Button>
        </form>
        <form action={declineOfferAction}>
          <input type="hidden" name="offerId" value={job.offer.id} />
          <Button className="w-full" type="submit" variant="outline">
            Decline
          </Button>
        </form>
      </div>
    </Card>
  );
}

function TodayJobCard({ job }: { job: CleanerDashboardJob }) {
  const booking = job.booking;
  const mode = job.offer.status === "in_progress" ? "in_progress" : "accepted";

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950">{slugToTitle(booking.service_slug)}</h3>
            <Badge className={lifecycleStatusBadgeClass(mode)}>{lifecycleStatusLabel(mode)}</Badge>
          </div>
          <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <JobFact icon={<Clock className="h-4 w-4" />} label="Time" value={formatTimeWindow(booking.booking_time)} />
            <JobFact icon={<MapPin className="h-4 w-4" />} label="Area" value={booking.suburb} />
          </dl>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <Briefcase className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-black text-slate-950 hover:bg-slate-50 sm:w-auto"
          href={`/cleaner/jobs#job-${job.offer.id}`}
        >
          View job
        </Link>
        {job.offer.status === "accepted" ? (
          <form action={startJobAction} className="w-full sm:w-auto">
            <input type="hidden" name="offerId" value={job.offer.id} />
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
              <Play className="h-4 w-4" />
              Start job
            </Button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

function JobFact({
  icon,
  label,
  value,
  strong = false,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon ? <span className="mt-0.5 shrink-0 text-emerald-700">{icon}</span> : null}
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
        <dd className={strong ? "font-black text-slate-950" : "font-semibold text-slate-700"}>{value}</dd>
      </div>
    </div>
  );
}

function EmptyAvailableJobs({ available }: { available: boolean }) {
  return (
    <Card className="grid min-h-64 place-items-center p-6 text-center sm:p-8">
      <div className="max-w-md">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <Gift className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-xl font-black text-slate-950">No available jobs right now</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          New jobs will appear here when they become available.
        </p>
        <form action={toggleAvailabilityAction} className="mt-5">
          <input type="hidden" name="available" value={available ? "false" : "true"} />
          <input type="hidden" name="returnTo" value="/cleaner" />
          <Button className="w-full sm:w-auto" type="submit">
            Update availability
          </Button>
        </form>
      </div>
    </Card>
  );
}

function SmallAvailableJobsEmpty() {
  return (
    <Card className="p-4 text-sm font-semibold text-slate-600 sm:p-5">
      No new offers right now.
    </Card>
  );
}
