import type { Metadata } from "next";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  fallbackCleanerPhoto,
  formatTenure,
  getCleanerName,
} from "@/lib/cleaner/portal";
import {
  updateCleanerAvailabilityAction,
  updateCleanerPasswordAction,
  updateCleanerProfileAction,
} from "../actions";
import { getCleanerPortalData } from "../_lib/portal-data";

export const metadata: Metadata = {
  title: "Cleaner Profile | Shalean",
};

type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CleanerProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const status = getParam(params, "status");
  const message = getParam(params, "message");
  const { dashboard, availability, readiness } = await getCleanerPortalData();
  const cleaner = dashboard.selectedCleaner;
  const cleanerName = getCleanerName(cleaner);

  return (
    <div className="space-y-3 sm:space-y-4">
      <section>
        <Badge>Profile</Badge>
        <h2 className="mt-1.5 text-xl font-black text-slate-950 sm:text-2xl lg:text-3xl">Cleaner account settings</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Update your contact details, service areas, profile image, and account preferences.
        </p>
      </section>

      {status && message ? (
        <div
          className={status === "error"
            ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
            : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900"}
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1fr_320px]">
        <section className="grid gap-3 sm:gap-4">
          <Card className="p-3.5 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Image
                alt={`${cleanerName} profile`}
                className="h-16 w-16 rounded-full object-cover sm:h-20 sm:w-20"
                height={80}
                src={cleaner.photo_url ?? fallbackCleanerPhoto}
                width={80}
              />
              <div>
                <h3 className="text-base font-black text-slate-950 sm:text-lg">{cleanerName}</h3>
                <p className="text-sm text-slate-600">Experience: {cleaner.experience_years} years</p>
                <p className="text-sm text-slate-600">Tenure: {formatTenure(cleaner.tenure_months)}</p>
              </div>
            </div>

            <form action={updateCleanerProfileAction} className="mt-3.5 grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Phone number</span>
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700"
                  defaultValue={cleaner.phone ?? ""}
                  inputMode="tel"
                  name="phone"
                  required
                  type="tel"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Service areas</span>
                <textarea
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700"
                  defaultValue={cleaner.suburbs.join(", ")}
                  name="serviceAreas"
                  placeholder="e.g. Sea Point, Green Point, Gardens"
                />
                <span className="text-xs text-slate-500">Use commas or new lines to separate areas.</span>
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Profile image URL</span>
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700"
                  defaultValue={cleaner.photo_url ?? ""}
                  name="photoUrl"
                  placeholder="https://..."
                  type="url"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Upload new profile image</span>
                <input
                  accept="image/*"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  name="photoFile"
                  type="file"
                />
                <span className="text-xs text-slate-500">JPG/PNG/WEBP up to 2MB.</span>
              </label>

              <button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white" type="submit">
                Save profile updates
              </button>
            </form>
          </Card>

          <Card className="p-3.5 sm:p-4">
            <h3 className="text-base font-black text-slate-950 sm:text-lg">Availability</h3>
            <p className="mt-1 text-sm text-slate-600">Status: {availability.label}</p>
            <p className="mt-1 text-sm text-slate-600">{availability.description}</p>

            <form action={updateCleanerAvailabilityAction} className="mt-3">
              <input
                name="availability"
                type="hidden"
                value={availability.state === "available" ? "paused" : "available"}
              />
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" type="submit">
                {availability.state === "available" ? "Pause availability" : "Set to Available"}
              </button>
            </form>
          </Card>

          <Card className="p-3.5 sm:p-4">
            <h3 className="text-base font-black text-slate-950 sm:text-lg">Password and account settings</h3>
            <p className="mt-1 text-sm text-slate-600">Change your password securely for cleaner login.</p>
            <form action={updateCleanerPasswordAction} className="mt-3 grid gap-2.5">
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-700">New password</span>
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700"
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Confirm new password</span>
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700"
                  minLength={8}
                  name="confirmPassword"
                  required
                  type="password"
                />
              </label>
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white" type="submit">
                Update password
              </button>
            </form>
          </Card>
        </section>

        <aside className="grid content-start gap-2.5 sm:gap-3">
          <Card className="p-3.5 sm:p-4">
            <h3 className="text-base font-bold text-slate-950">Account readiness</h3>
            <div className="mt-2.5 space-y-2 text-sm">
              {readiness.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">{item.label}</span>
                  <Badge>{item.value}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-3.5 sm:p-4">
            <h3 className="text-base font-bold text-slate-950">Equipment eligibility</h3>
            <p className="mt-1 text-sm text-slate-600">
              {cleaner.equipment_eligible
                ? "You are eligible for jobs that require equipment."
                : "You currently receive jobs without equipment requirements."}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function getParam(params: Awaited<ProfilePageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}
