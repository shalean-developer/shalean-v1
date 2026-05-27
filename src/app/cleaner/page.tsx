import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Briefcase, CheckCircle2, Clock, MapPin, Play, RotateCcw, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { clearCleanerSession, requireCleanerSession } from "@/lib/auth/server";
import { loadCleanerDashboard, type CleanerDashboardJob } from "@/lib/dashboard/data";
import {
  acceptCleanerOffer,
  completeCleanerJob,
  declineCleanerOffer,
  startCleanerJob,
} from "@/lib/regular-cleaning/offers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cleaner Dashboard | Shalean",
};

export const dynamic = "force-dynamic";

export default async function CleanerPage() {
  const cleanerSession = await requireCleanerSession();
  const cleanerId = cleanerSession.cleaner.id;
  const dashboard = await loadCleanerDashboard({ cleanerId });

  if (!dashboard.selectedCleaner) {
    return (
      <>
        <DashboardHeader active="cleaner" />
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <Badge>Cleaner platform</Badge>
            <h1 className="mt-3 text-3xl font-black">Cleaner dashboard</h1>
            <Card className="mt-8 p-6">
              <h2 className="text-xl font-bold">No active cleaner profile found</h2>
              <p className="mt-2 text-slate-600">
                Add an active Regular Cleaning cleaner in Supabase to view offers, accepted jobs, earnings, and job actions.
              </p>
            </Card>
          </div>
        </main>
      </>
    );
  }

  const selectedName = getCleanerName(dashboard.selectedCleaner);
  const activeCount = dashboard.upcomingJobs.length + dashboard.inProgressJobs.length;

  return (
    <>
      <DashboardHeader active="cleaner" />
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
        <Badge>Cleaner platform</Badge>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-black">Cleaner dashboard</h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              View offers, prepare for accepted bookings, navigate to customers, start jobs, and complete jobs.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-white p-3 shadow-sm">
            <Image
              className="h-12 w-12 rounded-full object-cover"
              src={dashboard.selectedCleaner.photo_url ?? fallbackPhoto}
              alt={`${selectedName} profile`}
              width={48}
              height={48}
            />
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-700">Viewing as</p>
              <p className="font-black text-slate-950">{selectedName}</p>
            </div>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Wallet className="h-5 w-5" />} label="Today earnings" value={formatZar(dashboard.todaysEarningsCents)} />
          <StatCard icon={<Briefcase className="h-5 w-5" />} label="New offers" value={String(dashboard.offers.length)} />
          <StatCard icon={<Clock className="h-5 w-5" />} label="Active jobs" value={String(activeCount)} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Completed" value={String(dashboard.completedJobs.length)} />
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="grid gap-5">
            <JobSection
              title="New offers"
              description="Accept jobs that fit your schedule. Full address appears after acceptance."
              empty="No new Regular Cleaning offers right now."
              jobs={dashboard.offers}
              render={(job) => <CleanerJobCard key={job.offer.id} job={job} mode="offer" />}
            />
            <JobSection
              title="In progress"
              description="Jobs already started and waiting to be completed."
              empty="No jobs are currently in progress."
              jobs={dashboard.inProgressJobs}
              render={(job) => <CleanerJobCard key={job.offer.id} job={job} mode="in_progress" />}
            />
            <JobSection
              title="Accepted / upcoming"
              description="Prepare, navigate, and start these confirmed jobs."
              empty="No accepted upcoming jobs yet."
              jobs={dashboard.upcomingJobs}
              render={(job) => <CleanerJobCard key={job.offer.id} job={job} mode="accepted" />}
            />
            <JobSection
              title="Completed"
              description="Recently completed Regular Cleaning jobs."
              empty="Completed jobs will appear here."
              jobs={dashboard.completedJobs}
              render={(job) => <CleanerJobCard key={job.offer.id} job={job} mode="completed" />}
            />
          </section>

          <aside className="grid content-start gap-5">
            <Card className="p-5">
              <h2 className="text-lg font-bold">Cleaner account</h2>
              <p className="mt-2 text-sm text-slate-600">
                You are signed in as {selectedName}. This dashboard only shows your offers and jobs.
              </p>
              <form action={cleanerLogoutAction} className="mt-4">
                <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" type="submit">
                  Sign out
                </button>
              </form>
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-bold">Readiness</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {dashboard.verification.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <Badge>{item.value}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
        </div>
      </main>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 text-emerald-700">{icon}</div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </Card>
  );
}

function JobSection({
  title,
  description,
  empty,
  jobs,
  render,
}: {
  title: string;
  description: string;
  empty: string;
  jobs: CleanerDashboardJob[];
  render: (job: CleanerDashboardJob) => ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <Badge className="w-fit">{jobs.length}</Badge>
      </div>
      <div className="mt-3 grid gap-3">
        {jobs.length > 0 ? jobs.map(render) : (
          <Card className="p-5 text-sm text-slate-600">{empty}</Card>
        )}
      </div>
    </section>
  );
}

function CleanerJobCard({ job, mode }: { job: CleanerDashboardJob; mode: "offer" | "accepted" | "in_progress" | "completed" }) {
  const booking = job.booking;
  const navigationUrl = job.safeAddress ? buildMapsUrl(job.safeAddress, booking.suburb) : null;

  return (
    <Card className="p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{slugToTitle(booking.service_slug)}</h3>
            <Badge className={statusBadgeClass(mode)}>{statusLabel(mode)}</Badge>
            {job.offer.is_preferred ? <Badge>Preferred request</Badge> : null}
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
            <p className="mt-1 text-sm text-slate-500">Full address unlocks after you accept.</p>
          )}
        </div>
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-left sm:text-right">
          <p className="text-xs font-semibold uppercase text-emerald-900">Your earning</p>
          <p className="text-xl font-black text-emerald-800">{formatZar(job.offer.earning_cents ?? 0)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
        <Detail label="Bedrooms" value={String(booking.bedrooms)} />
        <Detail label="Bathrooms" value={String(booking.bathrooms)} />
        <Detail label="Extra rooms" value={String(booking.extra_rooms)} />
        <Detail label="Add-ons" value={formatAddons(booking.addons)} />
        <Detail label="Equipment" value={booking.equipment?.label ?? "Without Equipment"} />
        <Detail label="Cleaner count" value={`${booking.cleaner_count} cleaner${booking.cleaner_count === 1 ? "" : "s"}`} />
        <Detail label="Estimated hours" value={formatHours(booking.estimated_minutes)} />
        <Detail label="Recurring" value={booking.recurringSeries ? `${slugToTitle(booking.recurringSeries.frequency)}, ${booking.recurringSeries.occurrence_count} visits` : "No"} />
        <Detail label="Payout rule" value={job.offer.earning_rule ?? "Regular Cleaning payout rule"} />
      </div>

      {booking.customer_notes ? (
        <div className="mt-3 rounded-md border border-slate-200 p-3 text-sm text-slate-600">
          <strong className="text-slate-950">Customer notes:</strong> {booking.customer_notes}
        </div>
      ) : null}

      {job.safeNotes ? (
        <div className="mt-3 rounded-md border border-slate-200 p-3 text-sm text-slate-600">
          <strong className="text-slate-950">Access notes:</strong> {job.safeNotes}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        {mode === "offer" ? (
          <>
            <form action={acceptOfferAction}>
              <HiddenOfferFields job={job} />
              <button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" type="submit">
                Accept
              </button>
            </form>
            <form action={declineOfferAction}>
              <HiddenOfferFields job={job} />
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" type="submit">
                Decline
              </button>
            </form>
          </>
        ) : null}

        {navigationUrl ? (
          <a
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
            href={navigationUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin className="h-4 w-4" />
            Navigate
          </a>
        ) : null}

        {mode === "accepted" ? (
          <form action={startJobAction}>
            <HiddenOfferFields job={job} />
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white" type="submit">
              <Play className="h-4 w-4" />
              Start job
            </button>
          </form>
        ) : null}

        {mode === "in_progress" ? (
          <form action={completeJobAction}>
            <HiddenOfferFields job={job} />
            <button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" type="submit">
              <CheckCircle2 className="h-4 w-4" />
              Complete job
            </button>
          </form>
        ) : null}

        {mode === "completed" ? (
          <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
            <RotateCcw className="h-4 w-4" />
            Ready for payout review
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function HiddenOfferFields({ job }: { job: CleanerDashboardJob }) {
  return (
    <>
      <input type="hidden" name="offerId" value={job.offer.id} />
    </>
  );
}

async function acceptOfferAction(formData: FormData) {
  "use server";

  const offerId = String(formData.get("offerId") ?? "");
  const { cleaner } = await requireCleanerSession();
  const cleanerId = cleaner.id;
  await acceptCleanerOffer(createSupabaseAdminClient(), { offerId, cleanerId });
  redirect("/cleaner");
}

async function declineOfferAction(formData: FormData) {
  "use server";

  const offerId = String(formData.get("offerId") ?? "");
  const { cleaner } = await requireCleanerSession();
  const cleanerId = cleaner.id;
  await declineCleanerOffer(createSupabaseAdminClient(), { offerId, cleanerId });
  redirect("/cleaner");
}

async function startJobAction(formData: FormData) {
  "use server";

  const offerId = String(formData.get("offerId") ?? "");
  const { cleaner } = await requireCleanerSession();
  const cleanerId = cleaner.id;
  await startCleanerJob(createSupabaseAdminClient(), { offerId, cleanerId });
  redirect("/cleaner");
}

async function completeJobAction(formData: FormData) {
  "use server";

  const offerId = String(formData.get("offerId") ?? "");
  const { cleaner } = await requireCleanerSession();
  const cleanerId = cleaner.id;
  await completeCleanerJob(createSupabaseAdminClient(), { offerId, cleanerId });
  redirect("/cleaner");
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <strong className="text-slate-950">{label}:</strong> {value}
    </span>
  );
}

async function cleanerLogoutAction() {
  "use server";

  await clearCleanerSession();
  redirect("/cleaner/login");
}

function getCleanerName(cleaner: { display_name: string | null; full_name: string | null }) {
  return cleaner.display_name ?? cleaner.full_name ?? "Shalean cleaner";
}

function formatAddons(addons: Array<{ label: string }>) {
  return addons.length > 0 ? addons.map((addon) => addon.label).join(", ") : "None";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatTimeWindow(timeWindow: string) {
  return timeWindow.replace("-", " - ");
}

function formatHours(minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return "To be confirmed";
  }

  return `${Number((minutes / 60).toFixed(1))}h`;
}

function buildMapsUrl(address: string, suburb: string) {
  const query = encodeURIComponent(`${address}, ${suburb}, Cape Town, South Africa`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function statusLabel(mode: "offer" | "accepted" | "in_progress" | "completed") {
  const labels = {
    offer: "New offer",
    accepted: "Accepted",
    in_progress: "In progress",
    completed: "Completed",
  };

  return labels[mode];
}

function statusBadgeClass(mode: "offer" | "accepted" | "in_progress" | "completed") {
  const classes = {
    offer: "border-sky-200 bg-sky-50 text-sky-800",
    accepted: "border-amber-200 bg-amber-50 text-amber-900",
    in_progress: "border-indigo-200 bg-indigo-50 text-indigo-800",
    completed: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return classes[mode];
}

const fallbackPhoto = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80";
