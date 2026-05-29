import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  FileWarning,
  RefreshCw,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingsActionFilter, BookingsActionMetrics } from "@/lib/admin/bookings-ui";

type ActionCard = {
  id: BookingsActionFilter;
  label: string;
  description: string;
  icon: typeof ClipboardList;
  tone: "rose" | "sky" | "amber" | "violet" | "slate" | "emerald";
};

const CARDS: ActionCard[] = [
  {
    id: "needs_action",
    label: "Needs action",
    description: "Assignment, payment, invoice, or Zoho issues",
    icon: ClipboardList,
    tone: "rose",
  },
  {
    id: "unassigned",
    label: "Unassigned bookings",
    description: "No cleaner assigned yet",
    icon: UserX,
    tone: "sky",
  },
  {
    id: "pending_payment",
    label: "Pending payments",
    description: "Awaiting customer or admin payment",
    icon: CircleDollarSign,
    tone: "amber",
  },
  {
    id: "invoice_issues",
    label: "Invoice issues",
    description: "Missing, overdue, or voided invoices",
    icon: FileWarning,
    tone: "violet",
  },
  {
    id: "zoho_failed",
    label: "Zoho sync errors",
    description: "Failed Zoho Books synchronization",
    icon: RefreshCw,
    tone: "rose",
  },
  {
    id: "todays_jobs",
    label: "Today's jobs",
    description: "Scheduled for today",
    icon: CalendarClock,
    tone: "emerald",
  },
];

const toneStyles = {
  rose: {
    card: "border-rose-200 hover:border-rose-300 hover:bg-rose-50/60",
    active: "border-rose-400 bg-rose-50 ring-1 ring-rose-200",
    icon: "border-rose-100 bg-rose-50 text-rose-700",
    count: "text-rose-700",
  },
  sky: {
    card: "border-sky-200 hover:border-sky-300 hover:bg-sky-50/60",
    active: "border-sky-400 bg-sky-50 ring-1 ring-sky-200",
    icon: "border-sky-100 bg-sky-50 text-sky-700",
    count: "text-sky-700",
  },
  amber: {
    card: "border-amber-200 hover:border-amber-300 hover:bg-amber-50/60",
    active: "border-amber-400 bg-amber-50 ring-1 ring-amber-200",
    icon: "border-amber-100 bg-amber-50 text-amber-700",
    count: "text-amber-700",
  },
  violet: {
    card: "border-violet-200 hover:border-violet-300 hover:bg-violet-50/60",
    active: "border-violet-400 bg-violet-50 ring-1 ring-violet-200",
    icon: "border-violet-100 bg-violet-50 text-violet-700",
    count: "text-violet-700",
  },
  slate: {
    card: "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80",
    active: "border-slate-400 bg-slate-50 ring-1 ring-slate-200",
    icon: "border-slate-200 bg-slate-50 text-slate-700",
    count: "text-slate-700",
  },
  emerald: {
    card: "border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/60",
    active: "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200",
    icon: "border-emerald-100 bg-emerald-50 text-emerald-700",
    count: "text-emerald-700",
  },
};

function metricForCard(metrics: BookingsActionMetrics, id: BookingsActionFilter) {
  switch (id) {
    case "needs_action":
      return metrics.needsActionCount;
    case "unassigned":
      return metrics.unassignedCount;
    case "pending_payment":
      return metrics.pendingPaymentCount;
    case "invoice_issues":
      return metrics.invoiceIssuesCount;
    case "zoho_failed":
      return metrics.zohoSyncErrorsCount;
    case "todays_jobs":
      return metrics.todaysJobsCount;
    default:
      return 0;
  }
}

export function AdminBookingsActionCards({
  metrics,
  activeFilter,
  onFilterSelect,
}: {
  metrics: BookingsActionMetrics;
  activeFilter: BookingsActionFilter | null;
  onFilterSelect: (filter: BookingsActionFilter) => void;
}) {
  return (
    <section
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      aria-label="Booking operations shortcuts"
    >
      {CARDS.map((card) => {
        const Icon = card.icon;
        const count = metricForCard(metrics, card.id);
        const styles = toneStyles[card.tone];
        const isActive = activeFilter === card.id;
        const hasAttention = count > 0 && (card.id === "needs_action" || card.id === "zoho_failed");

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onFilterSelect(card.id)}
            className={cn(
              "rounded-xl border bg-white px-3 py-3 text-left shadow-sm transition",
              styles.card,
              isActive && styles.active,
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className={cn("rounded-lg border p-1.5", styles.icon)}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-tight text-slate-600">{card.label}</p>
                <p className={cn("mt-0.5 text-xl font-black tracking-tight", styles.count)}>{count}</p>
                <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-snug text-slate-500">
                  {card.description}
                </p>
                {hasAttention && count > 0 ? (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    Review
                  </span>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}
