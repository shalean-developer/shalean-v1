import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { serviceCatalog } from "@/lib/booking/services";
import { capeTownSuburbs, siteConfig, suburbSlugs } from "@/lib/config/site";
import { slugToTitle } from "@/lib/utils";

type Props = {
  params: Promise<{ suburb: string }>;
};

export function generateStaticParams() {
  return suburbSlugs.map((suburb) => ({ suburb }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { suburb } = await params;
  const title = slugToTitle(suburb);

  return {
    title: `Cleaning Services in ${title} | ${siteConfig.shortName}`,
    description: `Book vetted cleaners and cleaning teams for regular, deep, Airbnb, move in/out, carpet, and office cleaning in ${title}, Cape Town.`,
  };
}

export default async function LocationPage({ params }: Props) {
  const { suburb } = await params;

  if (!suburbSlugs.includes(suburb)) {
    notFound();
  }

  const suburbName = capeTownSuburbs[suburbSlugs.indexOf(suburb)];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Local SEO page</p>
        <h1 className="mt-3 text-4xl font-black">Cleaning services in {suburbName}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          Shalean dispatches cleaners and cleaning teams across {suburbName} with saved booking progress, recurring services, Paystack checkout, and operational monitoring.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {serviceCatalog.map((service) => (
            <Link key={service.slug} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-500" href={`/services/${service.slug}`}>
              <h2 className="text-lg font-bold">{service.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.summary}</p>
            </Link>
          ))}
        </div>
        <Link className={buttonVariants({ className: "mt-8" })} href="/book">
          Book in {suburbName}
        </Link>
      </article>
    </main>
  );
}
