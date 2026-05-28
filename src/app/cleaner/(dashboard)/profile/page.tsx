import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CleanerAvailabilityToggle } from "@/components/cleaner/CleanerAvailabilityToggle";
import { cleanerLogoutAction } from "@/lib/cleaner/actions";
import { CLEANER_FALLBACK_PHOTO } from "@/lib/cleaner/format";
import { requireCleanerSession } from "@/lib/auth/server";
import { loadCleanerDashboard } from "@/lib/dashboard/data";
import { slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cleaner Profile | Shalean",
};

export const dynamic = "force-dynamic";

export default async function CleanerProfilePage() {
  const { cleaner } = await requireCleanerSession();
  const dashboard = await loadCleanerDashboard({ cleanerId: cleaner.id });

  if (!dashboard.profile || !dashboard.selectedCleaner) {
    redirect("/cleaner");
  }

  const profile = dashboard.profile;

  return (
    <div className="space-y-6 pb-4 sm:space-y-8">
      <header>
        <Badge>Profile</Badge>
        <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Your profile</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Account details, availability, and performance for your Regular Cleaning work.
        </p>
      </header>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 py-8 sm:px-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
            <Image
              className="h-24 w-24 rounded-full border-4 border-white/30 object-cover shadow-lg"
              src={profile.photoUrl ?? CLEANER_FALLBACK_PHOTO}
              alt={`${profile.name} profile`}
              width={96}
              height={96}
            />
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-black text-white">{profile.name}</h2>
              <p className="mt-1 text-sm text-emerald-100">
                {profile.active ? "Active cleaner" : "Inactive"} · Regular Cleaning
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          <ProfileField label="Phone" value={profile.phone ?? "Not set"} />
          <ProfileField label="Rating" value={profile.rating ? profile.rating.toFixed(1) : "—"} />
          <ProfileField label="Tenure" value={profile.tenureMonths ? `${profile.tenureMonths} months` : "New"} />
          <ProfileField
            label="Equipment"
            value={profile.equipmentEligible ? "Eligible for with-equipment jobs" : "Without equipment only"}
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <CleanerAvailabilityToggle available={profile.available} returnTo="/cleaner/profile" />
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="text-lg font-bold text-slate-950">Service coverage</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Services</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.serviceSlugs.length > 0 ? (
                profile.serviceSlugs.map((slug) => (
                  <Badge key={slug}>{slugToTitle(slug)}</Badge>
                ))
              ) : (
                <p className="text-sm text-slate-600">No services assigned.</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Suburbs</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.suburbs.length > 0 ? (
                profile.suburbs.map((suburb) => <Badge key={suburb}>{suburb}</Badge>)
              ) : (
                <p className="text-sm text-slate-600">No suburbs configured.</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="text-lg font-bold text-slate-950">Account readiness</h2>
        <dl className="mt-4 divide-y divide-slate-100">
          {dashboard.verification.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <dt className="text-sm text-slate-600">{item.label}</dt>
              <dd>
                <Badge>{item.value}</Badge>
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-4 sm:p-5">
        <form action={cleanerLogoutAction}>
          <button
            className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}
