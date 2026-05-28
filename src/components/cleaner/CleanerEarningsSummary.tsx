import { Calendar, Clock, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CleanerStatCard } from "@/components/cleaner/CleanerStatCard";
import type { CleanerEarningsSummary as EarningsSummary } from "@/lib/cleaner/types";
import { formatBookingDate } from "@/lib/cleaner/format";
import { formatZar } from "@/lib/utils";

type CleanerEarningsSummaryProps = {
  earnings: EarningsSummary;
};

export function CleanerEarningsSummary({ earnings }: CleanerEarningsSummaryProps) {
  return (
    <section className="scroll-mt-24">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CleanerStatCard icon={<Wallet className="h-5 w-5" />} label="Today" value={formatZar(earnings.todayCents)} />
        <CleanerStatCard icon={<Calendar className="h-5 w-5" />} label="This week" value={formatZar(earnings.weekCents)} />
        <CleanerStatCard icon={<TrendingUp className="h-5 w-5" />} label="This month" value={formatZar(earnings.monthCents)} />
        <CleanerStatCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending"
          value={formatZar(earnings.pendingCents)}
          hint={`${earnings.completedCount} completed job${earnings.completedCount === 1 ? "" : "s"}`}
        />
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-950">Recent completed jobs</h3>
          <Badge>{earnings.recentPayouts.length}</Badge>
        </div>
        {earnings.recentPayouts.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100">
            {earnings.recentPayouts.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{entry.label}</p>
                  <p className="text-xs text-slate-500">{formatBookingDate(entry.date)}</p>
                </div>
                <p className="shrink-0 font-black text-emerald-800">{formatZar(entry.amountCents)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Completed jobs with earnings will appear here.</p>
        )}
      </Card>
    </section>
  );
}
