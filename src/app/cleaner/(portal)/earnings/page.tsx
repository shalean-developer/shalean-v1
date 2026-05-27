import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatTimeWindow } from "@/lib/cleaner/portal";
import { formatZar, slugToTitle } from "@/lib/utils";
import { getCleanerPortalData } from "../_lib/portal-data";

export const metadata: Metadata = {
  title: "Cleaner Earnings | Shalean",
};

export default async function CleanerEarningsPage() {
  const { earnings } = await getCleanerPortalData();

  return (
    <div className="space-y-4 sm:space-y-5">
      <section>
        <Badge>Earnings</Badge>
        <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Cleaner earnings overview</h2>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-600 sm:text-base">
          Track your payouts and completed-job earnings history.
        </p>
      </section>

      <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <EarningCard label="Today earnings" value={formatZar(earnings.todayEarnings)} />
        <EarningCard label="Weekly earnings" value={formatZar(earnings.weeklyEarnings)} />
        <EarningCard label="Monthly earnings" value={formatZar(earnings.monthlyEarnings)} />
        <EarningCard label="Pending payouts" value={formatZar(earnings.pendingPayoutCents)} />
      </section>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Completed job earnings history</h3>
            <p className="text-sm text-slate-600">Recent completed jobs and what you earned per booking.</p>
          </div>
          <Badge>{earnings.history.length}</Badge>
        </div>

        <div className="mt-3 grid gap-2.5">
          {earnings.history.length > 0 ? earnings.history.map((job) => (
            <div
              key={job.offer.id}
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-950">{slugToTitle(job.booking.service_slug)}</p>
                  <p className="text-slate-600">
                    {formatDate(job.booking.booking_date)}, {formatTimeWindow(job.booking.booking_time)} in {job.booking.suburb}
                  </p>
                </div>
                <p className="text-base font-black text-emerald-800">{formatZar(job.offer.earning_cents ?? 0)}</p>
              </div>
            </div>
          )) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              No completed jobs yet. Complete bookings to populate your earnings history.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function EarningCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3.5 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{value}</p>
    </Card>
  );
}
