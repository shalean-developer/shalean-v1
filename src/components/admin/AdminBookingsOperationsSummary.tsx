import {
  AlertCircle,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { BookingsOperationsMetrics } from "@/lib/admin/bookings-ui";
import { formatZar } from "@/lib/utils";

function formatDelta(value: number) {
  if (value === 0) return "Same as yesterday";
  const arrow = value > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(value)} vs yesterday`;
}

function formatPercentDelta(value: number | null) {
  if (value == null) return "No prior month data";
  if (value === 0) return "Flat vs last month";
  const arrow = value > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(value)}% vs last month`;
}

export function AdminBookingsOperationsSummary({
  metrics,
  onPendingAssignmentClick,
}: {
  metrics: BookingsOperationsMetrics;
  onPendingAssignmentClick?: () => void;
}) {
  const cards = [
    {
      label: "Today's bookings",
      value: String(metrics.todaysBookings),
      detail: formatDelta(metrics.todaysBookingsDelta),
      icon: CalendarCheck2,
      tone: "green" as const,
    },
    {
      label: "Pending payment",
      value: String(metrics.pendingPaymentCount),
      detail: formatZar(metrics.pendingPaymentCents),
      icon: CircleDollarSign,
      tone: "orange" as const,
    },
    {
      label: "Pending assignment",
      value: String(metrics.pendingAssignmentCount),
      detail: onPendingAssignmentClick ? (
        <button
          type="button"
          onClick={onPendingAssignmentClick}
          className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline"
        >
          View bookings →
        </button>
      ) : (
        "Needs cleaner"
      ),
      icon: UserCheck,
      tone: "blue" as const,
    },
    {
      label: "Completed today",
      value: String(metrics.completedTodayCount),
      detail: formatDelta(metrics.completedTodayDelta),
      icon: ClipboardList,
      tone: "green" as const,
    },
    {
      label: "Overdue invoices",
      value: String(metrics.overdueInvoicesCount),
      detail: formatZar(metrics.overdueInvoicesCents),
      icon: AlertCircle,
      tone: "rose" as const,
    },
    {
      label: "Revenue this month",
      value: formatZar(metrics.revenueThisMonthCents),
      detail: formatPercentDelta(metrics.revenueMonthDeltaPercent),
      icon: TrendingUp,
      tone: "slate" as const,
    },
  ];

  const toneClass = {
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    blue: "border-sky-100 bg-sky-50 text-sky-700",
    orange: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  const detailToneClass = {
    green: "text-emerald-600",
    blue: "text-sky-600",
    orange: "text-amber-600",
    rose: "text-rose-600",
    slate: "text-slate-500",
  };

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border-slate-200 bg-white px-4 py-4 text-slate-900 shadow-sm">
            <div className="flex items-start gap-3">
              <span className={`rounded-lg border p-2 ${toneClass[card.tone]}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-600">{card.label}</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{card.value}</p>
                <div className={`mt-1 text-xs font-semibold ${detailToneClass[card.tone]}`}>
                  {card.detail}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </section>
  );
}
