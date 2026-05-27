import type React from "react";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { formatZar } from "@/lib/utils";

type AdminStats = {
  openBookings: number;
  needsAssignment: number;
  payoutReadyCents: number;
  paymentEvents: number;
};

export function AdminLayoutShell({
  adminName,
  stats,
  children,
}: {
  adminName: string;
  stats: AdminStats;
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardHeader active="admin" theme="dark" />
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="border-teal-300 bg-teal-100 text-teal-900">Admin command center</Badge>
              <h1 className="mt-3 text-3xl font-black">Shalean operations dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Signed in as {adminName}. Cleaner, customer, booking, payment, and settings tools are split into focused admin routes.
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">
              <span className="font-semibold text-white">Role:</span> Admin
            </div>
          </div>

          <AdminRouteNav />

          <section className="grid gap-4 lg:grid-cols-4">
            {[
              ["Open bookings", String(stats.openBookings)],
              ["Needs assignment", String(stats.needsAssignment)],
              ["Payout ready", formatZar(stats.payoutReadyCents)],
              ["Payment events", String(stats.paymentEvents)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/10 p-5">
                <p className="text-sm text-slate-300">{label}</p>
                <p className="mt-2 text-3xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          {children}
        </div>
      </main>
    </>
  );
}

export function AdminPageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      {children ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{children}</p> : null}
    </div>
  );
}
