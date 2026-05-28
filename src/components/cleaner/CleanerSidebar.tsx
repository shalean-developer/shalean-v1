"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Briefcase,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
  Wallet,
  X,
} from "lucide-react";
import { CleanerAvailabilityToggle } from "@/components/cleaner/CleanerAvailabilityToggle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cleanerLogoutAction } from "@/lib/cleaner/actions";
import { CLEANER_FALLBACK_PHOTO } from "@/lib/cleaner/format";
import type { CleanerNavItem } from "@/lib/cleaner/types";
import { cn } from "@/lib/utils";

const NAV_ITEMS: CleanerNavItem[] = [
  { href: "/cleaner", label: "Dashboard", icon: "dashboard" },
  { href: "/cleaner/jobs", label: "Jobs", icon: "jobs" },
  { href: "/cleaner/earnings", label: "Earnings", icon: "earnings" },
  { href: "/cleaner/profile", label: "Profile", icon: "profile" },
];

type CleanerSidebarProps = {
  cleanerName: string;
  photoUrl: string | null;
  available: boolean;
  offerCount: number;
  activeJobCount: number;
};

export function CleanerSidebar({
  cleanerName,
  photoUrl,
  available,
  offerCount,
  activeJobCount,
}: CleanerSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start gap-4">
        <Image
          className="h-16 w-16 rounded-full object-cover"
          src={photoUrl ?? CLEANER_FALLBACK_PHOTO}
          alt={`${cleanerName} profile`}
          width={64}
          height={64}
        />
        <div className="min-w-0 pt-1">
          <p className="text-xl font-black leading-tight text-slate-950">{cleanerName}</p>
          <Badge className="mt-2 border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-700" />
            {available ? "Online" : "Paused"}
          </Badge>
        </div>
      </div>

      <nav className="grid gap-2" aria-label="Cleaner navigation">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/cleaner"
              ? pathname === "/cleaner"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-bold transition",
                isActive
                  ? "bg-emerald-700 text-white shadow-sm shadow-emerald-700/20"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 pt-5">
        <Card className="mb-4 p-4 lg:hidden">
          <CleanerAvailabilityToggle available={available} returnTo={pathname || "/cleaner"} />
        </Card>

        <form action={cleanerLogoutAction}>
          <button
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            type="submit"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 col-span-full overflow-hidden border-b border-slate-200 bg-white lg:static">
        <div className="flex min-h-16 items-center justify-between bg-slate-950 px-3 text-white sm:px-6 lg:min-h-20 lg:px-8">
          <div className="flex items-center gap-3 lg:block">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-md text-white hover:bg-white/10 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="cleaner-mobile-nav"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <Link href="/cleaner" className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-400 sm:text-xs">
                Shalean
              </Link>
              <p className="text-sm font-black leading-tight sm:text-xl">Cleaner portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative grid h-9 w-9 place-items-center rounded-md text-white hover:bg-white/10 sm:h-10 sm:w-10"
              aria-label={`${offerCount} new offers and ${activeJobCount} active jobs`}
            >
              <Bell className="h-5 w-5" />
              {offerCount > 0 ? (
                <span className="absolute right-1 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1 text-[11px] font-black text-white">
                  {offerCount}
                </span>
              ) : null}
            </button>
            <div className="hidden items-center gap-2 text-sm font-bold lg:flex">
              <span>{cleanerName}</span>
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="hidden items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              className="h-10 w-10 rounded-full object-cover"
              src={photoUrl ?? CLEANER_FALLBACK_PHOTO}
              alt={`${cleanerName} profile`}
              width={40}
              height={40}
            />
            <p className="truncate text-xs font-black text-slate-950 sm:text-sm">{cleanerName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-700" />
              {available ? "Online" : "Paused"}
            </Badge>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="cleaner-mobile-nav"
            className="absolute left-0 top-0 flex h-full w-[min(100%,21rem)] flex-col border-r border-slate-200 bg-white p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <Badge>Cleaner portal</Badge>
              <button
                type="button"
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <aside className="hidden min-h-[calc(100vh-5rem)] px-4 py-5 lg:block">
        <div className="sticky top-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">{sidebar}</div>
      </aside>
    </>
  );
}

function NavIcon({ icon }: { icon: CleanerNavItem["icon"] }) {
  const className = "h-4 w-4 shrink-0";
  if (icon === "earnings") return <Wallet className={className} />;
  if (icon === "jobs") return <Briefcase className={className} />;
  if (icon === "profile") return <User className={className} />;
  if (icon === "dashboard") return <LayoutDashboard className={className} />;
  return <Briefcase className={className} />;
}
