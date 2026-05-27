import Link from "next/link";
import { redirect } from "next/navigation";
import { clearCleanerSession, getCleanerSession, getCurrentUser, getProfileForUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  active?: "admin" | "customer" | "cleaner";
  theme?: "light" | "dark";
};

export async function DashboardHeader({ active, theme = "light" }: DashboardHeaderProps) {
  const [user, cleanerSession] = await Promise.all([getCurrentUser(), getCleanerSession()]);
  const profile = user ? await getProfileForUser(user.id) : null;
  const dark = theme === "dark";

  const links = [
    { href: "/dashboard", label: "Customer", key: "customer", show: Boolean(user && profile?.role === "customer") },
    { href: "/bookings", label: "Bookings", key: "customer", show: Boolean(user && profile?.role === "customer") },
    { href: "/cleaner", label: "Cleaner", key: "cleaner", show: Boolean(cleanerSession) },
    { href: "/admin/cleaners", label: "Admin", key: "admin", show: Boolean(user && profile?.role === "admin") },
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
                active === link.key
                  ? "bg-emerald-700 text-white"
                  : dark ? "text-slate-200 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {link.label}
            </Link>
          ))}
          {!user && !cleanerSession ? (
            <>
              <Link className={buttonClass(dark, false)} href="/admin/login">Login</Link>
              <Link className={buttonClass(dark, false)} href="/cleaner/login">Cleaner sign in</Link>
              <Link className={buttonClass(dark, true)} href="/book">Book service</Link>
            </>
          ) : null}
          {user && !cleanerSession ? (
            <form action={signOutUserAction}>
              <button className={buttonClass(dark, false)} type="submit">Logout</button>
            </form>
          ) : null}
          {cleanerSession ? (
            <form action={signOutCleanerAction}>
              <button className={buttonClass(dark, false)} type="submit">Cleaner sign out</button>
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

async function signOutCleanerAction() {
  "use server";

  await clearCleanerSession();
  redirect("/");
}
