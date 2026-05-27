"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CleanerPortalShellProps = {
  cleanerName: string;
  cleanerPhotoUrl: string;
  availabilityLabel: string;
  availabilityBadgeClass: string;
  children: ReactNode;
};

const cleanerLinks = [
  { href: "/cleaner", label: "Dashboard" },
  { href: "/cleaner/earnings", label: "Earnings" },
  { href: "/cleaner/profile", label: "Profile" },
];

export function CleanerPortalShell({
  cleanerName,
  cleanerPhotoUrl,
  availabilityLabel,
  availabilityBadgeClass,
  children,
}: CleanerPortalShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-900 bg-slate-950 px-3 py-3 text-white sm:px-4 lg:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Shalean</p>
            <h1 className="text-base font-black sm:text-lg">Cleaner portal</h1>
          </div>
          <button
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close cleaner menu" : "Open cleaner menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10 lg:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <p className="hidden text-sm text-slate-200 lg:block">Signed in as {cleanerName}</p>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden">
          <div className="h-full w-[82%] max-w-sm bg-white p-4 shadow-xl">
            <MobileCleanerMenu
              availabilityBadgeClass={availabilityBadgeClass}
              availabilityLabel={availabilityLabel}
              cleanerName={cleanerName}
              cleanerPhotoUrl={cleanerPhotoUrl}
              onClose={() => setMobileMenuOpen(false)}
              onNavigate={() => setMobileMenuOpen(false)}
              pathname={pathname}
            />
          </div>
        </div>
      ) : null}

      <main className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 lg:grid-cols-[250px_1fr] lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden lg:block">
          <DesktopCleanerNav
            availabilityBadgeClass={availabilityBadgeClass}
            availabilityLabel={availabilityLabel}
            cleanerName={cleanerName}
            cleanerPhotoUrl={cleanerPhotoUrl}
            pathname={pathname}
          />
        </aside>
        <section className="min-w-0">{children}</section>
      </main>
    </div>
  );
}

function DesktopCleanerNav({
  cleanerName,
  cleanerPhotoUrl,
  availabilityLabel,
  availabilityBadgeClass,
  pathname,
}: {
  cleanerName: string;
  cleanerPhotoUrl: string;
  availabilityLabel: string;
  availabilityBadgeClass: string;
  pathname: string;
}) {
  return (
    <Card className="sticky top-4 p-4">
      <div className="flex items-center gap-3">
        <Image alt={`${cleanerName} profile`} className="h-12 w-12 rounded-full object-cover" height={48} src={cleanerPhotoUrl} width={48} />
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Cleaner</p>
          <p className="font-bold text-slate-950">{cleanerName}</p>
        </div>
      </div>
      <Badge className={cn("mt-3", availabilityBadgeClass)}>{availabilityLabel}</Badge>

      <nav className="mt-4 grid gap-2">
        {cleanerLinks.map((link) => (
          <Link
            key={link.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-bold transition",
              isActiveLink(pathname, link.href)
                ? "bg-emerald-700 text-white"
                : "text-slate-700 hover:bg-slate-100",
            )}
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <form action="/cleaner/logout" className="mt-5" method="post">
        <button className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" type="submit">
          Sign out
        </button>
      </form>
    </Card>
  );
}

function MobileCleanerMenu({
  cleanerName,
  cleanerPhotoUrl,
  availabilityLabel,
  availabilityBadgeClass,
  pathname,
  onClose,
  onNavigate,
}: {
  cleanerName: string;
  cleanerPhotoUrl: string;
  availabilityLabel: string;
  availabilityBadgeClass: string;
  pathname: string;
  onClose: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image alt={`${cleanerName} profile`} className="h-11 w-11 rounded-full object-cover" height={44} src={cleanerPhotoUrl} width={44} />
          <div>
            <p className="text-sm font-bold text-slate-900">{cleanerName}</p>
            <Badge className={cn("mt-1", availabilityBadgeClass)}>{availabilityLabel}</Badge>
          </div>
        </div>
        <button
          aria-label="Close cleaner menu"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="mt-5 grid gap-2">
        {cleanerLinks.map((link) => (
          <Link
            key={link.href}
            className={cn(
              "rounded-md px-3 py-2.5 text-sm font-bold transition",
              isActiveLink(pathname, link.href)
                ? "bg-emerald-700 text-white"
                : "text-slate-800 hover:bg-slate-100",
            )}
            href={link.href}
            onClick={onNavigate}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <form action="/cleaner/logout" className="mt-auto" method="post">
        <button className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700" onClick={onNavigate} type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}

function isActiveLink(pathname: string, href: string) {
  if (href === "/cleaner") {
    return pathname === "/cleaner";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
