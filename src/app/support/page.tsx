import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { requireCustomer } from "@/lib/auth/server";
import { supportContact } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Support | Shalean",
};

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  await requireCustomer();

  return (
    <>
      <DashboardHeader active="support" />
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Support</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Need help?</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Our Cape Town team is here to help with bookings, payments, rescheduling, and anything else.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2 text-emerald-800">
                <MessageCircle className="h-5 w-5" aria-hidden />
                <h2 className="text-lg font-bold text-slate-950">WhatsApp support</h2>
              </div>
              <p className="text-sm text-slate-600">
                Fastest way to reach us. Chat with the team for quick answers.
              </p>
              <p className="text-base font-bold text-slate-950">{supportContact.whatsappNumber}</p>
              <a
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                href={supportContact.whatsappHref}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Chat on WhatsApp
              </a>
            </Card>

            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2 text-emerald-800">
                <Phone className="h-5 w-5" aria-hidden />
                <h2 className="text-lg font-bold text-slate-950">Call us</h2>
              </div>
              <p className="text-sm text-slate-600">
                Prefer to talk? Give our support line a call during business hours.
              </p>
              <p className="text-base font-bold text-slate-950">{supportContact.callNumber}</p>
              <a
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                href={supportContact.callHref}
              >
                <Phone className="h-4 w-4" aria-hidden />
                Call support
              </a>
            </Card>
          </div>

          <Card className="mt-4 p-5">
            <h2 className="text-lg font-bold text-slate-950">Manage a booking</h2>
            <p className="mt-2 text-sm text-slate-600">
              View booking details, tracking, payment records, and booking actions from your dashboard.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" href="/bookings">
                View bookings
              </Link>
              <Link className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700" href="/book?new=1">
                Start new booking
              </Link>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
