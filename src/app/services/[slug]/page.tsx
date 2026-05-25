import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getService, serviceCatalog } from "@/lib/booking/services";
import { siteConfig } from "@/lib/config/site";
import { formatZar } from "@/lib/utils";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return serviceCatalog.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);

  if (!service) {
    return {};
  }

  return {
    title: `${service.title} in Cape Town | ${siteConfig.shortName}`,
    description: service.description,
    keywords: service.seoKeywords,
  };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = getService(slug);

  if (!service) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <Badge>{service.requiresTeam ? "Team workflow" : "Cleaner workflow"}</Badge>
        <h1 className="mt-4 text-4xl font-black">{service.title} in Cape Town</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">{service.description}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Starting price</p>
            <p className="mt-2 text-2xl font-bold">{formatZar(service.baseCents)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Minimum hours</p>
            <p className="mt-2 text-2xl font-bold">{service.minHours}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Equipment</p>
            <p className="mt-2 text-2xl font-bold">{service.allowEquipmentAddon ? "Optional" : "Included"}</p>
          </div>
        </div>
        <section className="mt-10 rounded-lg bg-slate-950 p-6 text-white">
          <h2 className="text-2xl font-bold">Marketplace workflow</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This service uses the Shalean canonical booking lifecycle, real-time quote calculation, assignment controls, payout validation, and audit trail model.
          </p>
          <Link className={buttonVariants({ className: "mt-5" })} href={`/book?service=${service.slug}`}>
            Book {service.title}
          </Link>
        </section>
      </article>
    </main>
  );
}
