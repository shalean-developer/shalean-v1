"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
  CalendarRange,
  CircleHelp,
  Home,
  Menu,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    title: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Overview", icon: Home },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/bookings", label: "Bookings", icon: CalendarRange },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/cleaners", label: "Cleaners", icon: UsersRound },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/payments", label: "Payments", icon: Banknote },
      { href: "/admin/pricing", label: "Pricing", icon: Tags },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/admin/dashboard#reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
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
  const allLinks = useMemo(() => navGroups.flatMap((group) => group.items), []);
  const activeRoute = useMemo(
    () => allLinks.find((link) => isActiveLink(pathname, link.href)),
    [allLinks, pathname],
  );

  return (
    <>
      <div className="lg:hidden">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          type="button"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      </div>
      <aside className="hidden w-72 shrink-0 lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
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
          <div className="relative h-full w-[min(21rem,90vw)] border-r border-slate-200 bg-[#f8fafc] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Shalean navigation</p>
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
    <div className="space-y-4">
      <nav className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((link) => {
                  const active = isActiveLink(pathname, link.href);
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                        active
                          ? "border border-emerald-100 bg-emerald-50 text-emerald-800"
                          : "border border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                      )}
                      href={link.href}
                      onClick={onNavigate}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live pulse</p>
        <dl className="mt-3 space-y-3 text-sm text-slate-700">
          <MetricRow label="Open bookings" value={String(stats.openBookings)} />
          <MetricRow label="Needs assignment" value={String(stats.needsAssignment)} />
          <MetricRow label="Payment events" value={String(stats.paymentEvents)} />
          <MetricRow label="Role" value="Admin" icon={ShieldCheck} />
        </dl>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <CircleHelp className="h-4 w-4 text-slate-500" />
          Need help?
        </p>
        <p className="mt-1 text-xs text-slate-500">View guides or contact support.</p>
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

function isActiveLink(pathname: string, href: string) {
  const normalizedHref = href.split("#")[0] ?? href;
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}
