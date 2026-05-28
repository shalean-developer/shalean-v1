import Link from "next/link";
import { getCurrentUser, getProfileForUser } from "@/lib/auth/server";
import { DashboardNav, type DashboardNavLink } from "@/components/dashboard/DashboardNav";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  active?: "dashboard" | "bookings" | "profile" | "support" | "admin" | "customer";
  theme?: "light" | "dark";
};

export async function DashboardHeader({ active, theme = "light" }: DashboardHeaderProps) {
  const user = await getCurrentUser();
  const profile = user ? await getProfileForUser(user.id) : null;
  const dark = theme === "dark";
  const isCustomer = Boolean(user && profile?.role === "customer");
  const isAdmin = Boolean(user && profile?.role === "admin");

  // Treat the legacy "customer" active value as the Dashboard tab.
  const activeKey = active === "customer" ? "dashboard" : active;

  const links: Array<DashboardNavLink & { show: boolean }> = [
    { href: "/dashboard", label: "Dashboard", key: "dashboard", show: isCustomer },
    { href: "/bookings", label: "Bookings", key: "bookings", show: isCustomer },
    { href: "/profile", label: "Profile", key: "profile", show: isCustomer },
    { href: "/support", label: "Support", key: "support", show: isCustomer },
    { href: "/admin/dashboard", label: "Admin", key: "admin", show: isAdmin },
  ];

  const visibleLinks = links.filter((link) => link.show).map(({ href, label, key }) => ({ href, label, key }));

  return (
    <header className={cn(
      "border-b px-4 py-3 sm:px-6 lg:px-8",
      dark ? "border-white/10 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950",
    )}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/" className="font-black tracking-tight">
          Shalean Cleaning Services
        </Link>
        <DashboardNav links={visibleLinks} activeKey={activeKey} loggedIn={Boolean(user)} dark={dark} />
      </div>
    </header>
  );
}
