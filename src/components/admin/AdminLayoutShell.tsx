import type React from "react";
import { Banknote, CalendarClock, CreditCard, UserRoundCheck } from "lucide-react";
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
  const kpis = [
    {
      label: "Open bookings",
      value: String(stats.openBookings),
      icon: CalendarClock,
      accent: "from-sky-100 to-cyan-50",
      iconClass: "text-sky-700",
    },
    {
      label: "Needs assignment",
      value: String(stats.needsAssignment),
      icon: UserRoundCheck,
      accent: "from-amber-100 to-orange-50",
      iconClass: "text-amber-700",
    },
    {
      label: "Payout ready",
      value: formatZar(stats.payoutReadyCents),
      icon: Banknote,
      accent: "from-emerald-100 to-emerald-50",
      iconClass: "text-emerald-700",
    },
    {
      label: "Payment events",
      value: String(stats.paymentEvents),
      icon: CreditCard,
      accent: "from-violet-100 to-fuchsia-50",
      iconClass: "text-violet-700",
    },
  ];

  return (
    <>
      <DashboardHeader active="admin" theme="light" />
      <main className="min-h-screen bg-slate-50 px-4 pb-10 pt-6 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
          <AdminRouteNav stats={stats} />
          <div className="min-w-0 flex-1 space-y-7">
            <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <Badge className="border-teal-300/80 bg-teal-100 text-teal-900">Admin command center</Badge>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-3xl font-black tracking-tight">Shalean operations dashboard</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Signed in as {adminName}. Cleaner, customer, booking, payment, and settings tools are grouped for fast operations.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Role: Admin
                </div>
              </div>
            </header>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.label}
                    className="group relative h-full overflow-hidden rounded-xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.accent} opacity-100`} />
                    <div className="relative flex h-full min-h-32 flex-col justify-between">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-600">{item.label}</p>
                        <span className={`rounded-lg border border-slate-200 bg-white p-2 ${item.iconClass}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                      <p className="text-3xl font-black tracking-tight text-slate-950">{item.value}</p>
                    </div>
                  </article>
                );
              })}
            </section>
            {children}
          </div>
        </div>
      </main>
    </>
  );
}

export function AdminPageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
      {children ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{children}</p> : null}
    </div>
  );
}
