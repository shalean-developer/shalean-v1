import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Banknote, CalendarClock, UsersRound } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { loadAdminDashboard } from "@/lib/dashboard/data";
import { formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin Dashboard | Shalean",
};

export const dynamic = "force-dynamic";

const quickActions = [
  { href: "/admin/bookings", title: "Manage bookings", description: "Create, assign, and monitor booking state." },
  { href: "/admin/customers", title: "Customer records", description: "Review and update customer profiles." },
  { href: "/admin/cleaners", title: "Cleaner workforce", description: "Activate cleaners and manage account access." },
  { href: "/admin/payments", title: "Payments and payouts", description: "Track payment status and payout readiness." },
  { href: "/admin/settings", title: "Platform settings", description: "Audit admin security and lifecycle states." },
];

export default async function AdminDashboardPage() {
  const dashboard = await loadAdminDashboard();

  return (
    <div className="space-y-5">
      <AdminPageHeading eyebrow="Operations overview" title="Command center">
        Daily admin health metrics, quick route actions, and booking assignment signals are grouped below.
      </AdminPageHeading>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.03] p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 p-2 text-emerald-200">
              <Banknote className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-bold">Operations overview</h3>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <MetricLine label="Addon revenue" value={formatZar(dashboard.metrics.addonRevenueCents)} />
            <MetricLine label="Equipment requests" value={String(dashboard.metrics.equipmentRequests)} />
            <MetricLine label="Preferred cleaners" value={String(dashboard.metrics.preferredCleaners)} />
            <MetricLine label="Auto assignments" value={String(dashboard.metrics.autoAssignments)} />
          </dl>
        </Card>

        <Card className="border-white/10 bg-white/[0.03] p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-sky-300/40 bg-sky-500/15 p-2 text-sky-200">
              <UsersRound className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-bold">Quick actions</h3>
          </div>
          <div className="mt-4 space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div>
                  <p className="font-semibold text-slate-100">{action.title}</p>
                  <p className="text-xs text-slate-400">{action.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="border-white/10 bg-white/[0.03] p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-violet-300/40 bg-violet-500/15 p-2 text-violet-200">
              <CalendarClock className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-bold">Booking management</h3>
          </div>
          <p className="mt-4 text-sm text-slate-300">Recent activity with current booking and payment states.</p>
          <div className="mt-3 space-y-2">
            {dashboard.recentBookings.length > 0 ? dashboard.recentBookings.map((booking) => (
              <div key={booking.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-300">
                <p className="font-semibold text-slate-100">{booking.customer?.full_name ?? "Customer unavailable"}</p>
                <p className="mt-1">{booking.suburb} • {booking.booking_date} {booking.booking_time}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="border-white/20 bg-slate-800 text-slate-100">{slugToTitle(booking.booking_status)}</Badge>
                  <Badge className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200">{slugToTitle(booking.payment_status)}</Badge>
                </div>
              </div>
            )) : <p className="text-sm text-slate-400">No recent bookings.</p>}
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <dt className="text-slate-300">{label}</dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  );
}
