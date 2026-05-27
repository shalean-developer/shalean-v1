"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin/cleaners", label: "Cleaners" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminRouteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/10 p-2 text-sm font-bold">
      {adminLinks.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 transition",
              active ? "bg-emerald-700 text-white" : "text-slate-100 hover:bg-white/10",
            )}
            href={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
