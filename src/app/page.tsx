import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, CalendarCheck, CreditCard, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { clearCleanerSession, getCleanerSession, getCurrentUser, getProfileForUser } from "@/lib/auth/server";
import { siteConfig, suburbSlugs } from "@/lib/config/site";
import { serviceCatalog } from "@/lib/booking/services";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatZar } from "@/lib/utils";

const platformStats = [
  ["6", "Launch services"],
  ["9", "Booking stages"],
  ["R250+", "Payout guard"],
  ["24/7", "Ops visibility"],
];

const platformFeatures: Array<{ title: string; icon: LucideIcon; text: string }> = [
  {
    title: "Customer platform",
    icon: CalendarCheck,
    text: "Persistent booking wizard, recurring schedules, checkout readiness, and live booking tracking.",
  },
  {
    title: "Cleaner platform",
    icon: UsersRound,
    text: "Verification, availability, offers, assignments, team support, earnings, and performance views.",
  },
  {
    title: "Finance controls",
    icon: CreditCard,
    text: "Paystack integration points, webhook verification, payout guards, refunds, and reconciliation tables.",
  },
  {
    title: "Dispatch engine",
    icon: ShieldCheck,
    text: "Canonical lifecycle transitions with auto, manual, preferred cleaner, and team assignment modes.",
  },
  {
    title: "Admin command",
    icon: BarChart3,
    text: "Operational analytics, manual bookings, lifecycle monitoring, customer management, and audit trails.",
  },
  {
    title: "SEO growth",
    icon: ArrowRight,
    text: "Programmatic service and suburb pages, schema-ready content, internal links, and local SEO structure.",
  },
];

export default async function Home() {
  const [user, cleanerSession] = await Promise.all([getCurrentUser(), getCleanerSession()]);
  const profile = user ? await getProfileForUser(user.id) : null;
  const dashboardHref = profile?.role === "admin"
    ? "/admin/cleaners"
    : profile?.role === "customer"
      ? "/dashboard"
      : "/cleaner";
  const isLoggedIn = Boolean(user || cleanerSession);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: siteConfig.name,
    url: siteConfig.url,
    email: siteConfig.email,
    telephone: siteConfig.phone,
    areaServed: siteConfig.serviceArea,
    priceRange: "R250-R350+",
    serviceType: serviceCatalog.map((service) => service.title),
  };

  return (
    <main className="bg-slate-50 text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-35">
          <Image
            alt="Professional home cleaning team preparing a bright living room"
            className="h-full w-full object-cover"
            src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1800&q=80"
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="relative mx-auto grid min-h-[720px] max-w-7xl content-between px-4 py-5 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between">
            <Link className="text-lg font-bold" href="/">{siteConfig.shortName}</Link>
            <div className="hidden items-center gap-6 text-sm font-semibold text-white/80 md:flex">
              <Link href="/book">Book</Link>
              <Link href="/dashboard">Customers</Link>
              <Link href="/cleaner">Cleaners</Link>
              <Link href="/admin/cleaners">Admin</Link>
            </div>
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <Link className={buttonVariants({ variant: "outline", size: "sm", className: "border-white/30 bg-white/10 text-white hover:bg-white/20" })} href={dashboardHref}>
                    Dashboard
                  </Link>
                  <form action={homeLogoutAction}>
                    <button className={buttonVariants({ variant: "primary", size: "sm" })} type="submit">
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link className={buttonVariants({ variant: "outline", size: "sm", className: "border-white/30 bg-white/10 text-white hover:bg-white/20" })} href="/admin/login">
                    Login
                  </Link>
                  <Link className={buttonVariants({ variant: "primary", size: "sm" })} href="/book">
                    Book now
                  </Link>
                </>
              )}
            </div>
          </nav>

          <div className="max-w-3xl pb-10 pt-24 sm:pb-16">
            <Badge className="border-white/20 bg-white/15 text-white">Cape Town cleaning marketplace</Badge>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight sm:text-6xl">
              Shalean Cleaning Services
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/85">
              Mobile-first booking, real-time pricing, cleaner dispatch, Paystack checkout, and operations control for a premium cleaning marketplace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ size: "lg" })} href="/book">
                Start booking <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className={buttonVariants({ variant: "outline", size: "lg", className: "border-white/30 bg-white/10 text-white hover:bg-white/20" })} href="/admin/cleaners">
                View operations
              </Link>
            </div>
          </div>

          <div className="grid gap-3 pb-4 sm:grid-cols-4">
            {platformStats.map(([value, label]) => (
              <div key={label} className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-2xl font-bold">{value}</div>
                <div className="mt-1 text-sm text-white/75">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Badge>Initial services</Badge>
            <h2 className="mt-3 text-3xl font-bold">Built for real cleaning operations</h2>
          </div>
          <Link className="text-sm font-semibold text-emerald-800" href="/book">
            Price a booking now
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {serviceCatalog.map((service) => (
            <Card key={service.slug} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-bold">{service.title}</h3>
                {service.requiresTeam ? <Badge>Team</Badge> : <Badge>Cleaner</Badge>}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{service.summary}</p>
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-500">From {formatZar(service.baseCents)}</span>
                <Link className="font-semibold text-emerald-800" href={`/services/${service.slug}`}>
                  SEO page
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          {platformFeatures.map(({ title, icon: Icon, text }) => (
            <div key={title} className="rounded-lg border border-slate-200 p-5">
              <Icon className="h-6 w-6 text-emerald-700" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-slate-950 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold">Cape Town suburb targeting</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {suburbSlugs.slice(0, 12).map((slug) => (
              <Link key={slug} className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/20" href={`/locations/${slug}`}>
                {slug.replaceAll("-", " ")}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

async function homeLogoutAction() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await Promise.all([
    supabase.auth.signOut(),
    clearCleanerSession(),
  ]);
  redirect("/");
}
