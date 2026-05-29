import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, ChevronDown, Search } from "lucide-react";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import {
  ADMIN_PAGE_DESCRIPTION_CLASS,
  ADMIN_PAGE_TITLE_CLASS,
} from "@/components/admin/admin-page-styles";
import { signOutAdminAction } from "@/lib/admin/auth-actions";

export { ADMIN_PAGE_DESCRIPTION_CLASS, ADMIN_PAGE_TITLE_CLASS } from "@/components/admin/admin-page-styles";

type AdminStats = {
  openBookings: number;
  needsAssignment: number;
  payoutReadyCents: number;
  paymentEvents: number;
};

const adminMenuLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/cleaners", label: "Cleaners" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/settings", label: "Settings" },
];

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
  const firstName = adminName.trim().split(/\s+/)[0] || "Admin";

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-slate-950">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-sm">
        <div className="flex w-full flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center gap-2 text-slate-900">
            <Image src="/shalean-logo.svg" alt="Shalean logo" width={32} height={32} className="h-8 w-8 rounded-full" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-[0.14em] text-emerald-700">Shalean</p>
              <p className="truncate text-xs text-slate-500">Admin workspace</p>
            </div>
          </div>
          <div className="flex w-full flex-1 items-center gap-3 lg:justify-end">
            <div className="w-full max-w-[560px]">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search bookings, customers, cleaners..."
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:bg-slate-50">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    {adminInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{firstName}</p>
                    <p className="text-xs text-slate-500">Administrator</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <div className="mb-1 border-b border-slate-100 px-2 pb-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{firstName}</p>
                    <p className="text-xs text-slate-500">Administrator</p>
                  </div>
                  <nav className="space-y-1">
                    {adminMenuLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <form action={signOutAdminAction}>
                      <button
                        className="w-full rounded-md px-2 py-1.5 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                        type="submit"
                      >
                        Logout
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>
      <div className="flex w-full flex-col gap-4 px-3 pb-8 pt-4 sm:px-4 lg:flex-row lg:items-start lg:gap-5 lg:px-6">
        <AdminRouteNav stats={stats} />
        <div className="min-w-0 flex-1 space-y-4">
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
      <h2 className={`mt-2 ${ADMIN_PAGE_TITLE_CLASS}`}>{title}</h2>
      {children ? <p className={ADMIN_PAGE_DESCRIPTION_CLASS}>{children}</p> : null}
    </div>
  );
}
