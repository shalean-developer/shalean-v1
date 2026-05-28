"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, BarChart3, CalendarRange, Menu, Settings, ShieldCheck, Users, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/cleaners", label: "Cleaners", icon: UsersRound },
  { href: "/admin/payments", label: "Payments", icon: Banknote },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

type AdminStats = {
  openBookings: number;
  needsAssignment: number;
  payoutReadyCents: number;
  paymentEvents: number;
};

export function AdminRouteNav({ stats }: { stats: AdminStats }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeRoute = useMemo(() => adminLinks.find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)), [pathname]);

  return (
    <>
      <div className="lg:hidden">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          type="button"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      </div>
      <aside className="hidden w-72 shrink-0 lg:block">
        <SidebarBody pathname={pathname} stats={stats} />
      </aside>
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-900/30"
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-[min(21rem,90vw)] border-r border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Admin navigation</p>
              <button
                className="rounded-md border border-slate-300 p-2 text-slate-700 transition hover:bg-slate-100"
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarBody
              pathname={pathname}
              stats={stats}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}
      <div className="lg:hidden">
        <Badge className="border-slate-200 bg-slate-100 text-slate-700">
          Active: {activeRoute?.label ?? "Dashboard"}
        </Badge>
      </div>
    </>
  );
}

function SidebarBody({
  pathname,
  stats,
  onNavigate,
}: {
  pathname: string;
  stats: AdminStats;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin workspace</p>
        <p className="mt-2 text-lg font-bold text-slate-900">Operations console</p>
        <p className="mt-1 text-sm text-slate-600">Route-level tools grouped for daily operations.</p>
      </div>
      <nav className="rounded-xl border border-slate-200 bg-white p-2">
        {adminLinks.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              className={cn(
                "mb-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition last:mb-0",
                active
                  ? "bg-emerald-600/90 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.7)]"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
              )}
              href={link.href}
              onClick={onNavigate}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live pulse</p>
        <dl className="mt-3 space-y-3 text-sm text-slate-700">
          <MetricRow label="Open bookings" value={String(stats.openBookings)} />
          <MetricRow label="Needs assignment" value={String(stats.needsAssignment)} />
          <MetricRow label="Payment events" value={String(stats.paymentEvents)} />
          <MetricRow label="Role" value="Admin" icon={ShieldCheck} />
        </dl>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof ShieldCheck;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="flex items-center gap-2 text-slate-600">
        {Icon ? <Icon className="h-3.5 w-3.5 text-emerald-600" /> : null}
        {label}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
