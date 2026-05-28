import { CheckCircle2, MapPin, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CleanerJobLifecycle } from "@/components/cleaner/CleanerJobLifecycle";
import {
  acceptOfferAction,
  completeJobAction,
  declineOfferAction,
  startJobAction,
} from "@/lib/cleaner/actions";
import {
  buildMapsUrl,
  formatAddons,
  formatBookingDate,
  formatEstimatedHours,
  formatTimeWindow,
  lifecycleStatusBadgeClass,
  lifecycleStatusLabel,
} from "@/lib/cleaner/format";
import type { CleanerJobLifecycleMode } from "@/lib/cleaner/types";
import type { CleanerDashboardJob } from "@/lib/dashboard/data";
import { formatZar, slugToTitle } from "@/lib/utils";

type CleanerJobCardProps = {
  job: CleanerDashboardJob;
  mode: CleanerJobLifecycleMode;
};

export function CleanerJobCard({ job, mode }: CleanerJobCardProps) {
  const booking = job.booking;
  const navigationUrl = job.safeAddress ? buildMapsUrl(job.safeAddress, booking.suburb) : null;
  const showNavigate = Boolean(navigationUrl) && mode !== "offer";

  return (
    <Card className="overflow-hidden p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-950 sm:text-lg">{slugToTitle(booking.service_slug)}</h3>
            <Badge className={lifecycleStatusBadgeClass(mode)}>{lifecycleStatusLabel(mode)}</Badge>
            {job.offer.is_preferred ? <Badge>Preferred request</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {formatBookingDate(booking.booking_date)}, {formatTimeWindow(booking.booking_time)} in {booking.suburb}
          </p>
          {job.safeAddress ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-slate-800">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>{job.safeAddress}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Full address unlocks after you accept.</p>
          )}
        </div>
        <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 lg:text-right">
          <p className="text-xs font-semibold uppercase text-emerald-900">Your earning</p>
          <p className="text-xl font-black text-emerald-800">{formatZar(job.offer.earning_cents ?? 0)}</p>
        </div>
      </div>

      <div className="mt-4">
        <CleanerJobLifecycle current={mode} compact />
      </div>

      <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
        <JobDetail label="Bedrooms" value={String(booking.bedrooms)} />
        <JobDetail label="Bathrooms" value={String(booking.bathrooms)} />
        <JobDetail label="Extra rooms" value={String(booking.extra_rooms)} />
        <JobDetail label="Add-ons" value={formatAddons(booking.addons)} />
        <JobDetail label="Equipment" value={booking.equipment?.label ?? "Without Equipment"} />
        <JobDetail label="Cleaners" value={`${booking.cleaner_count} cleaner${booking.cleaner_count === 1 ? "" : "s"}`} />
        <JobDetail label="Estimated hours" value={formatEstimatedHours(booking.estimated_minutes)} />
        <JobDetail
          label="Recurring"
          value={
            booking.recurringSeries
              ? `${slugToTitle(booking.recurringSeries.frequency)}, ${booking.recurringSeries.occurrence_count} visits`
              : "No"
          }
        />
        <JobDetail label="Payout rule" value={job.offer.earning_rule ?? "Regular Cleaning payout rule"} />
      </div>

      {booking.customer_notes ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
          <strong className="text-slate-950">Customer notes:</strong> {booking.customer_notes}
        </div>
      ) : null}

      {job.safeNotes ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
          <strong className="text-slate-950">Access notes:</strong> {job.safeNotes}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {mode === "offer" ? (
          <>
            <form action={acceptOfferAction} className="w-full sm:w-auto">
              <HiddenOfferId offerId={job.offer.id} />
              <Button type="submit" className="w-full sm:w-auto">
                Accept
              </Button>
            </form>
            <form action={declineOfferAction} className="w-full sm:w-auto">
              <HiddenOfferId offerId={job.offer.id} />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Decline
              </Button>
            </form>
          </>
        ) : null}

        {showNavigate && navigationUrl ? (
          <a
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-50 sm:w-auto"
            href={navigationUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin className="h-4 w-4" />
            Navigate
          </a>
        ) : null}

        {mode === "accepted" ? (
          <form action={startJobAction} className="w-full sm:w-auto">
            <HiddenOfferId offerId={job.offer.id} />
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
              <Play className="h-4 w-4" />
              Start job
            </Button>
          </form>
        ) : null}

        {mode === "in_progress" ? (
          <form action={completeJobAction} className="w-full sm:w-auto">
            <HiddenOfferId offerId={job.offer.id} />
            <Button type="submit" className="w-full sm:w-auto">
              <CheckCircle2 className="h-4 w-4" />
              Complete job
            </Button>
          </form>
        ) : null}

        {mode === "completed" ? (
          <span className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 sm:w-auto">
            <RotateCcw className="h-4 w-4" />
            Ready for payout review
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function HiddenOfferId({ offerId }: { offerId: string }) {
  return <input type="hidden" name="offerId" value={offerId} />;
}

function JobDetail({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <strong className="text-slate-950">{label}:</strong> {value}
    </span>
  );
}
