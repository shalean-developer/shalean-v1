import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfileForUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  const links = [
    { href: "/dashboard", label: "Dashboard", key: "dashboard", show: isCustomer },
    { href: "/bookings", label: "Bookings", key: "bookings", show: isCustomer },
    { href: "/profile", label: "Profile", key: "profile", show: isCustomer },
    { href: "/support", label: "Support", key: "support", show: isCustomer },
    { href: "/admin/dashboard", label: "Admin", key: "admin", show: isAdmin },
  ];

  return (
    <header className={cn(
      "border-b px-4 py-3 sm:px-6 lg:px-8",
      dark ? "border-white/10 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950",
    )}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="font-black tracking-tight">
          Shalean Cleaning Services
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {links.filter((link) => link.show).map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-bold",
                activeKey === link.key
                  ? "bg-emerald-700 text-white"
                  : dark ? "text-slate-200 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {link.label}
            </Link>
          ))}
          {!user ? (
            <>
              <Link className={buttonClass(dark, false)} href="/admin/login">Login</Link>
              <Link className={buttonClass(dark, false)} href="/cleaner/login">Cleaner sign in</Link>
              <Link className={buttonClass(dark, true)} href="/book">Book service</Link>
            </>
          ) : null}
          {user ? (
            <form action={signOutUserAction}>
              <button className={buttonClass(dark, false)} type="submit">Logout</button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function buttonClass(dark: boolean, primary: boolean) {
  if (primary) {
    return "inline-flex min-h-9 items-center rounded-md bg-emerald-700 px-3 py-2 text-sm font-bold text-white";
  }

  return cn(
    "inline-flex min-h-9 items-center rounded-md border px-3 py-2 text-sm font-bold",
    dark ? "border-white/15 text-slate-100 hover:bg-white/10" : "border-slate-300 text-slate-700 hover:bg-slate-50",
  );
}

async function signOutUserAction() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
