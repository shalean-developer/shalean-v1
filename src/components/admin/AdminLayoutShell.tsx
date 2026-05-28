import type React from "react";
import { Bell, Search } from "lucide-react";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";

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
  const adminInitial = adminName.trim().charAt(0).toUpperCase() || "A";

  return (
    <main className="min-h-screen bg-[#f3f5f7] px-3 pb-8 pt-4 text-slate-950 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <AdminRouteNav stats={stats} />
        <div className="min-w-0 flex-1 space-y-4">
          <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Shalean Cleaning Services</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">Admin workspace</p>
                  <p className="mt-1 text-sm text-slate-600">Operations control center</p>
                </div>
                <div className="w-full max-w-[640px]">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search bookings, customers, cleaners..."
                      className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {adminInitial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{adminName}</p>
                      <p className="text-xs text-slate-500">Administrator</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}

export function AdminPageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">{title}</h2>
      {children ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{children}</p> : null}
    </div>
  );
}
