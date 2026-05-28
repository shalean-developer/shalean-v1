import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { getProfileForUser, requireCustomer } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Profile | Shalean",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user } = await requireCustomer();
  const profile = await getProfileForUser(user.id);

  const fullName = profile?.full_name?.trim() || "Shalean customer";
  const email = user.email ?? null;
  const phone = profile?.phone?.trim() || null;

  return (
    <>
      <DashboardHeader active="profile" />
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Profile</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Your account</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            These details are used for your bookings and payment receipts.
          </p>

          <Card className="mt-8 p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <User className="h-7 w-7" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-950">{fullName}</p>
                <p className="text-sm text-slate-600">Customer account</p>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-4">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                  <Mail className="h-4 w-4" aria-hidden /> Email
                </dt>
                <dd className="mt-1 break-words font-semibold text-slate-950">{email ?? "Not provided"}</dd>
              </div>
              <div className="rounded-md bg-slate-50 p-4">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                  <Phone className="h-4 w-4" aria-hidden /> Phone
                </dt>
                <dd className="mt-1 break-words font-semibold text-slate-950">{phone ?? "Not provided"}</dd>
              </div>
            </dl>
          </Card>

          <Card className="mt-4 p-5">
            <h2 className="text-lg font-bold text-slate-950">Quick links</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" href="/bookings">
                Your bookings
              </Link>
              <Link className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700" href="/support">
                Get support
              </Link>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
