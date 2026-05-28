import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CalendarCheck2,
  CalendarPlus2,
  CircleDollarSign,
  ClipboardList,
  FileBarChart2,
  Link2,
  ShieldAlert,
  Star,
  UserCheck,
  UserPlus,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ADMIN_PAGE_DESCRIPTION_CLASS, ADMIN_PAGE_TITLE_CLASS } from "@/components/admin/AdminLayoutShell";
import { loadAdminDashboard, type DashboardBooking } from "@/lib/dashboard/data";
import { formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin Dashboard | Shalean",
};

export const dynamic = "force-dynamic";

const quickActions = [
  { href: "/admin/bookings", title: "Create booking", icon: CalendarPlus2 },
  { href: "/admin/customers", title: "Add customer", icon: UserPlus },
  { href: "/admin/cleaners", title: "Add cleaner", icon: UserRoundPlus },
  { href: "/admin/bookings", title: "Assign cleaner", icon: UserCheck },
  { href: "/admin/payments", title: "Send payment link", icon: Link2 },
  { href: "/admin/payments", title: "View reports", icon: FileBarChart2 },
];

export default async function AdminDashboardPage() {
  const dashboard = await loadAdminDashboard();
  const model = buildOverviewModel(dashboard);

  return (
    <div className="space-y-4">
      <section className="py-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className={ADMIN_PAGE_TITLE_CLASS}>Dashboard overview</h1>
            <p className={ADMIN_PAGE_DESCRIPTION_CLASS}>
              Monitor bookings, cleaners, payments, and operational risk in one place.
            </p>
          </div>
          <Badge className="inline-flex h-fit items-center gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{model.todayDisplay}</span>
          </Badge>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {model.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <TodayScheduleCard schedule={model.schedule} />
        <CleanerStatusCard cleaners={model.cleanerStatus} />
      </section>

      <section id="reports" className="grid gap-4 xl:grid-cols-3">
        <RevenueSnapshotCard rows={model.revenueSnapshot} />
        <BookingStatusCard
          breakdown={model.bookingBreakdown}
          chartGradient={model.chartGradient}
          totalBookings={model.totalBookings}
        />
        <AlertsIssuesCard alerts={model.alerts} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.35fr_1fr]">
        <RecentActivityCard activity={model.recentActivity} />
        <TopAreasCard areas={model.topAreas} maxAreaCount={model.maxAreaCount} />
      </section>

      <section>
        <Card className="border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Quick actions</h2>
            <Badge className="border-slate-200 bg-slate-50 text-slate-700">Operations shortcuts</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={`${action.href}-${action.title}`}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <span className="rounded-lg border border-emerald-100 bg-white p-2 text-emerald-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  {action.title}
                </Link>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}

type OverviewData = Awaited<ReturnType<typeof loadAdminDashboard>>;

type Kpi = {
  label: string;
  value: string;
  detail: string;
  icon: typeof CalendarCheck2;
  tone: "green" | "blue" | "orange" | "rose" | "slate";
};

function buildOverviewModel(dashboard: OverviewData) {
  const todayIso = formatDateKey(new Date());
  const yesterdayIso = shiftDateKey(todayIso, -1);
  const weekStartIso = shiftDateKey(todayIso, -6);
  const monthStartIso = `${todayIso.slice(0, 8)}01`;
  const bookings = dashboard.recentBookings;
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const todayBookings = bookings.filter((booking) => booking.booking_date === todayIso).toSorted((left, right) => left.booking_time.localeCompare(right.booking_time));
  const yesterdayBookings = bookings.filter((booking) => booking.booking_date === yesterdayIso);
  const todayRevenueCents = todayBookings.reduce((total, booking) => total + (paymentStatusForBooking(booking) === "paid" ? booking.final_total_cents : 0), 0);
  const yesterdayRevenueCents = yesterdayBookings.reduce((total, booking) => total + (paymentStatusForBooking(booking) === "paid" ? booking.final_total_cents : 0), 0);
  const activeCleanerMap = new Map(
    bookings
      .map((booking) => booking.selectedCleaner)
      .filter((cleaner): cleaner is NonNullable<DashboardBooking["selectedCleaner"]> => Boolean(cleaner))
      .filter((cleaner) => cleaner.active)
      .map((cleaner) => [cleaner.id, cleaner]),
  );
  const activeCleaners = Array.from(activeCleanerMap.values());
  const cleanerRatings = activeCleaners.map((cleaner) => cleaner.rating).filter((rating) => rating > 0);
  const pendingPayments = bookings.filter((booking) => {
    const status = paymentStatusForBooking(booking);
    return status !== "paid" && status !== "refunded";
  }).length;
  const bookedThisWeek = bookings.filter((booking) => booking.booking_date >= weekStartIso && booking.booking_date <= todayIso);
  const paidThisWeekCents = bookedThisWeek.reduce((total, booking) => total + (paymentStatusForBooking(booking) === "paid" ? booking.final_total_cents : 0), 0);
  const bookedThisMonth = bookings.filter((booking) => booking.booking_date >= monthStartIso && booking.booking_date <= todayIso);
  const paidThisMonthCents = bookedThisMonth.reduce((total, booking) => total + (paymentStatusForBooking(booking) === "paid" ? booking.final_total_cents : 0), 0);

  const bookingBreakdown = buildBookingBreakdown(bookings);
  const totalBreakdown = bookingBreakdown.reduce((total, segment) => total + segment.value, 0);
  const chartGradient = totalBreakdown === 0
    ? "#e2e8f0 0deg 360deg"
    : bookingBreakdown.reduce<{ segments: string[]; offset: number }>((state, segment) => {
      const angle = (segment.value / totalBreakdown) * 360;
      state.segments.push(`${segment.color} ${state.offset}deg ${state.offset + angle}deg`);
      return { segments: state.segments, offset: state.offset + angle };
    }, { segments: [], offset: 0 }).segments.join(", ");

  const schedule = todayBookings.slice(0, 8).map((booking) => ({
    id: booking.id,
    window: booking.booking_time,
    customer: booking.customer?.full_name ?? "Customer unavailable",
    area: booking.suburb,
    cleaner: booking.selectedCleaner?.display_name ?? booking.selectedCleaner?.full_name ?? null,
    status: booking.selected_cleaner_id ? (booking.booking_status === "in_progress" ? "Cleaning" : "Assigned") : "Unassigned",
  }));

  const cleanerStatus = activeCleaners
    .map((cleaner) => {
      const cleanerBookings = bookings.filter((booking) => booking.selected_cleaner_id === cleaner.id);
      const hasInProgress = cleanerBookings.some((booking) => booking.booking_status === "in_progress");
      const hasUpcomingToday = cleanerBookings.some((booking) => booking.booking_date === todayIso && booking.booking_status === "confirmed");
      const status = hasInProgress ? "Cleaning" : hasUpcomingToday ? "Travelling" : cleaner.available ? "Available" : "Offline";

      return {
        id: cleaner.id,
        name: cleaner.display_name ?? cleaner.full_name ?? "Cleaner unavailable",
        status,
        area: cleaner.suburbs[0] ?? "Cape Town",
        jobsInView: cleanerBookings.length,
      };
    })
    .toSorted((left, right) => right.jobsInView - left.jobsInView)
    .slice(0, 6);

  const alerts: Array<{ title: string; detail: string; tone: "critical" | "warning" | "info" | "success" }> = [
    dashboard.stats.needsAssignment > 0
      ? { title: `${dashboard.stats.needsAssignment} bookings need cleaner assignment`, detail: "Urgent", tone: "critical" as const }
      : null,
    pendingPayments > 0
      ? { title: `${pendingPayments} pending customer payments`, detail: "Action needed", tone: "warning" as const }
      : null,
    dashboard.declinedOffers.length > 0
      ? { title: `${dashboard.declinedOffers.length} declined cleaner offers`, detail: "Review offers", tone: "warning" as const }
      : null,
    dashboard.metrics.equipmentRequests > 0
      ? { title: `${dashboard.metrics.equipmentRequests} equipment requests in queue`, detail: "Monitor supply", tone: "info" as const }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 4);

  if (alerts.length === 0) {
    alerts.push({ title: "No operational issues detected", detail: "All systems healthy", tone: "success" });
  }

  const recentActivity = [
    ...dashboard.recentPayments.map((payment) => {
      const booking = payment.booking_id ? bookingsById.get(payment.booking_id) : null;
      const customerName = booking?.customer?.full_name ?? "Customer";
      const paid = payment.status === "paid";

      return {
        id: `payment-${payment.id}`,
        timestamp: payment.created_at,
        timeLabel: formatTimeLabel(payment.created_at),
        title: paid ? `Payment received from ${customerName}` : `Payment ${slugToTitle(payment.status)}`,
        subtitle: booking ? `Booking in ${booking.suburb}` : "Booking reference unavailable",
        amount: formatZar(payment.amount_cents),
        tone: paid ? "success" as const : "warning" as const,
      };
    }),
    ...bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      timestamp: booking.created_at,
      timeLabel: formatTimeLabel(booking.created_at),
      title: booking.selectedCleaner
        ? `Booking assigned to ${booking.selectedCleaner.display_name ?? booking.selectedCleaner.full_name ?? "cleaner"}`
        : "New booking awaiting assignment",
      subtitle: `${booking.customer?.full_name ?? "Customer"} • ${booking.suburb}`,
      amount: formatZar(booking.final_total_cents),
      tone: booking.selectedCleaner ? "info" as const : "warning" as const,
    })),
  ]
    .toSorted((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 7);

  const areaCounts = new Map<string, number>();
  bookedThisWeek.forEach((booking) => {
    areaCounts.set(booking.suburb, (areaCounts.get(booking.suburb) ?? 0) + 1);
  });
  const topAreas = Array.from(areaCounts.entries())
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([area, count]) => ({ area, count }));
  const maxAreaCount = topAreas[0]?.count ?? 1;

  return {
    todayDisplay: formatFullDate(todayIso),
    kpis: [
      {
        label: "Bookings Today",
        value: String(todayBookings.length),
        detail: trendText(todayBookings.length, yesterdayBookings.length, "from yesterday"),
        icon: CalendarCheck2,
        tone: "blue",
      },
      {
        label: "Active Cleaners",
        value: String(activeCleaners.length),
        detail: `${activeCleaners.filter((cleaner) => cleaner.available).length} available now`,
        icon: UsersRound,
        tone: "green",
      },
      {
        label: "Revenue Today",
        value: formatZar(todayRevenueCents),
        detail: trendText(todayRevenueCents, yesterdayRevenueCents, "from yesterday"),
        icon: Banknote,
        tone: "green",
      },
      {
        label: "Pending Payments",
        value: String(pendingPayments),
        detail: pendingPayments > 0 ? "Follow up required" : "All clear",
        icon: CircleDollarSign,
        tone: pendingPayments > 0 ? "orange" : "slate",
      },
      {
        label: "Unassigned Jobs",
        value: String(dashboard.stats.needsAssignment),
        detail: dashboard.stats.needsAssignment > 0 ? "Needs attention" : "Assignments healthy",
        icon: ClipboardList,
        tone: dashboard.stats.needsAssignment > 0 ? "orange" : "slate",
      },
      {
        label: "Customer Rating",
        value: cleanerRatings.length > 0 ? `${average(cleanerRatings).toFixed(1)} ★` : "N/A",
        detail: cleanerRatings.length > 0 ? `${cleanerRatings.length} rated cleaners` : "No ratings in view",
        icon: Star,
        tone: "green",
      },
    ] satisfies Kpi[],
    schedule,
    cleanerStatus,
    revenueSnapshot: [
      { label: "Today", value: formatZar(todayRevenueCents), ratio: ratio(todayRevenueCents, paidThisMonthCents) },
      { label: "This week", value: formatZar(paidThisWeekCents), ratio: ratio(paidThisWeekCents, paidThisMonthCents) },
      { label: "This month", value: formatZar(paidThisMonthCents), ratio: 1 },
      { label: "Pending payouts", value: formatZar(dashboard.stats.payoutReadyCents), ratio: ratio(dashboard.stats.payoutReadyCents, paidThisMonthCents) },
    ],
    bookingBreakdown,
    chartGradient,
    totalBookings: totalBreakdown,
    alerts,
    recentActivity,
    topAreas,
    maxAreaCount,
  };
}

function KpiCard({ label, value, detail, icon: Icon, tone }: Kpi) {
  const toneClass = {
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    blue: "border-sky-100 bg-sky-50 text-sky-700",
    orange: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];
  const detailToneClass = {
    green: "text-emerald-600",
    blue: "text-sky-600",
    orange: "text-amber-600",
    rose: "text-rose-600",
    slate: "text-slate-500",
  }[tone];

  return (
    <Card className="h-full border-slate-200 bg-white px-3 py-3 text-center text-slate-900 shadow-sm">
      <div className="flex flex-col items-center gap-2">
        <span className={`rounded-lg border p-1.5 ${toneClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className="text-3xl font-black tracking-tight text-slate-950">{value}</p>
        <p className={`text-xs font-semibold ${detailToneClass}`}>{detail}</p>
      </div>
    </Card>
  );
}

function TodayScheduleCard({
  schedule,
}: {
  schedule: Array<{
    id: string;
    window: string;
    customer: string;
    area: string;
    cleaner: string | null;
    status: string;
  }>;
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Today&apos;s schedule</h2>
        <Link href="/admin/bookings" className="text-xs font-semibold text-sky-700 hover:text-sky-800">View all</Link>
      </div>
      <div className="space-y-2">
        {schedule.length > 0 ? schedule.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">{item.window}</p>
              <p className="truncate text-sm font-semibold text-slate-900">{item.customer}</p>
              <p className="truncate text-xs text-slate-500">{item.area} • {item.cleaner ?? "No cleaner assigned"}</p>
            </div>
            <StatusBadge label={item.status} />
          </div>
        )) : <p className="text-sm text-slate-500">No bookings scheduled for today.</p>}
      </div>
    </Card>
  );
}

function CleanerStatusCard({
  cleaners,
}: {
  cleaners: Array<{ id: string; name: string; status: string; area: string; jobsInView: number }>;
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Cleaner status</h2>
        <Link href="/admin/cleaners" className="text-xs font-semibold text-sky-700 hover:text-sky-800">View all</Link>
      </div>
      <div className="space-y-2">
        {cleaners.length > 0 ? cleaners.map((cleaner) => (
          <div key={cleaner.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{cleaner.name}</p>
              <p className="truncate text-xs text-slate-500">{cleaner.area} • {cleaner.jobsInView} bookings in view</p>
            </div>
            <StatusBadge label={cleaner.status} />
          </div>
        )) : <p className="text-sm text-slate-500">No active cleaner activity found.</p>}
      </div>
    </Card>
  );
}

function RevenueSnapshotCard({
  rows,
}: {
  rows: Array<{ label: string; value: string; ratio: number }>;
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Revenue snapshot</h2>
        <Link href="/admin/payments" className="text-xs font-semibold text-sky-700 hover:text-sky-800">View report</Link>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <p className="font-semibold text-slate-700">{row.label}</p>
              <p className="font-semibold text-slate-900">{row.value}</p>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${row.label === "Pending payouts" ? "bg-amber-400" : "bg-emerald-500"}`}
                style={{ width: `${Math.max(8, row.ratio * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">All amounts in ZAR</p>
    </Card>
  );
}

function BookingStatusCard({
  breakdown,
  chartGradient,
  totalBookings,
}: {
  breakdown: Array<{ label: string; value: number; color: string }>;
  chartGradient: string;
  totalBookings: number;
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Booking status</h2>
        <Link href="/admin/bookings" className="text-xs font-semibold text-sky-700 hover:text-sky-800">View all</Link>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div
          className="h-36 w-36 rounded-full"
          style={{ background: `conic-gradient(${chartGradient})` }}
          aria-hidden
        />
        <div className="w-full space-y-2">
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">Total bookings in view: {totalBookings}</p>
    </Card>
  );
}

function AlertsIssuesCard({
  alerts,
}: {
  alerts: Array<{ title: string; detail: string; tone: "critical" | "warning" | "info" | "success" }>;
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Alerts &amp; issues</h2>
        <Badge className="border-slate-200 bg-slate-50 text-slate-600">Live</Badge>
      </div>
      <div className="space-y-2.5">
        {alerts.map((alert) => (
          <div key={alert.title} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 ${iconToneClass(alert.tone)}`}>
                {alert.tone === "critical"
                  ? <ShieldAlert className="h-4 w-4" />
                  : alert.tone === "warning"
                    ? <AlertTriangle className="h-4 w-4" />
                    : <ArrowUpRight className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                <p className="text-xs font-semibold text-slate-500">{alert.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentActivityCard({
  activity,
}: {
  activity: Array<{
    id: string;
    timeLabel: string;
    title: string;
    subtitle: string;
    amount: string;
    tone: "success" | "warning" | "info";
  }>;
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Recent activity</h2>
        <Link href="/admin/bookings" className="text-xs font-semibold text-sky-700 hover:text-sky-800">View all</Link>
      </div>
      <div className="space-y-2.5">
        {activity.length > 0 ? activity.map((item) => (
          <div key={item.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <p className="text-xs font-semibold text-slate-500">{item.timeLabel}</p>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
            </div>
            <p className={`text-sm font-bold ${amountToneClass(item.tone)}`}>{item.amount}</p>
          </div>
        )) : <p className="text-sm text-slate-500">No recent activity.</p>}
      </div>
    </Card>
  );
}

function TopAreasCard({
  areas,
  maxAreaCount,
}: {
  areas: Array<{ area: string; count: number }>;
  maxAreaCount: number;
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Top areas this week</h2>
        <Badge className="border-slate-200 bg-slate-50 text-slate-700">Last 7 days</Badge>
      </div>
      <div className="space-y-3">
        {areas.length > 0 ? areas.map((area) => (
          <div key={area.area}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <p className="font-semibold text-slate-700">{area.area}</p>
              <p className="text-xs font-semibold text-slate-500">{area.count} bookings</p>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(area.count / maxAreaCount) * 100}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">No area data available this week.</p>}
      </div>
    </Card>
  );
}

function StatusBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const cls = normalized.includes("unassigned")
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : normalized.includes("offline")
      ? "border-slate-200 bg-slate-100 text-slate-600"
      : normalized.includes("cleaning")
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : normalized.includes("travel")
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-sky-200 bg-sky-50 text-sky-700";

  return <Badge className={cls}>{label}</Badge>;
}

function buildBookingBreakdown(bookings: DashboardBooking[]) {
  const counts = {
    Completed: 0,
    Assigned: 0,
    "Pending Payment": 0,
    Unassigned: 0,
    Cancelled: 0,
  };

  bookings.forEach((booking) => {
    if (booking.booking_status === "cancelled") {
      counts.Cancelled += 1;
      return;
    }
    if (booking.booking_status === "completed") {
      counts.Completed += 1;
      return;
    }
    if (paymentStatusForBooking(booking) !== "paid") {
      counts["Pending Payment"] += 1;
      return;
    }
    if (!booking.selected_cleaner_id) {
      counts.Unassigned += 1;
      return;
    }
    counts.Assigned += 1;
  });

  return [
    { label: "Completed", value: counts.Completed, color: "#22c55e" },
    { label: "Assigned", value: counts.Assigned, color: "#60a5fa" },
    { label: "Pending Payment", value: counts["Pending Payment"], color: "#f59e0b" },
    { label: "Unassigned", value: counts.Unassigned, color: "#94a3b8" },
    { label: "Cancelled", value: counts.Cancelled, color: "#ef4444" },
  ];
}

function paymentStatusForBooking(booking: DashboardBooking) {
  return booking.payment?.status ?? booking.payment_status;
}

function ratio(value: number, max: number) {
  if (max <= 0) return 0.1;
  return Math.min(1, Math.max(0.1, value / max));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, current) => total + current, 0) / values.length;
}

function trendText(current: number, previous: number, suffix: string) {
  if (previous === 0) {
    return current > 0 ? `+100% ${suffix}` : `0% ${suffix}`;
  }
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.abs(delta).toFixed(0);
  return `${delta >= 0 ? "+" : "-"}${rounded}% ${suffix}`;
}

function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(date);
}

function shiftDateKey(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatFullDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(`${isoDate}T12:00:00.000Z`));
}

function formatTimeLabel(isoTimestamp: string) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

function iconToneClass(tone: "critical" | "warning" | "info" | "success") {
  if (tone === "critical") return "text-rose-600";
  if (tone === "warning") return "text-amber-600";
  if (tone === "success") return "text-emerald-600";
  return "text-sky-600";
}

function amountToneClass(tone: "success" | "warning" | "info") {
  if (tone === "success") return "text-emerald-700";
  if (tone === "warning") return "text-amber-700";
  return "text-sky-700";
}
