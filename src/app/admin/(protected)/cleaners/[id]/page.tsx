import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, CalendarClock, KeyRound, Star } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { CleanerPhoneField } from "@/components/admin/CleanerPhoneField";
import { Card } from "@/components/ui/card";
import {
  resetCleanerPasswordAction,
  setCleanerStatusAction,
  updateCleanerAction,
} from "@/lib/admin/actions";
import { CLEANER_STATUS_META, deriveCleanerStatus } from "@/lib/admin/cleaner-status";
import { loadAdminCleanerProfile, type AdminCleanerBooking } from "@/lib/admin/data";
import { normalizeAdminCleanerPhone } from "@/lib/admin/utils";
import { cn, formatZar, slugToTitle } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cleaner Profile | Shalean",
};

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_ACTIONS: Array<{ value: "active" | "inactive" | "suspended"; label: string }> = [
  { value: "active", label: "Activate" },
  { value: "inactive", label: "Deactivate" },
  { value: "suspended", label: "Suspend" },
];

export default async function CleanerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await loadAdminCleanerProfile(id);

  if (!profile) {
    notFound();
  }

  const { cleaner, bookings } = profile;
  const status = deriveCleanerStatus(cleaner);
  const meta = CLEANER_STATUS_META[status];
  const name = cleaner.display_name ?? cleaner.full_name ?? "Unnamed cleaner";
  const phone = normalizeAdminCleanerPhone(cleaner.phone ?? "");

  return (
    <>
      <AdminPageHeading eyebrow="Cleaner section" title={name}>
        Review and manage this cleaner&apos;s account, status, credentials, and booking history.
      </AdminPageHeading>

      <Link
        href="/admin/cleaners"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cleaners
      </Link>

      <Card className="border-slate-200 bg-white p-5 text-slate-950 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">{name}</h3>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
                    meta.badgeClass,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 break-all text-sm text-slate-500">{cleaner.auth_email ?? "No login email yet"}</p>
              <p className="text-sm text-slate-500">{phone || "No phone on file"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_ACTIONS.filter((action) => action.value !== status).map((action) => (
              <form key={action.value} action={setCleanerStatusAction}>
                <input type="hidden" name="cleanerId" value={cleaner.id} />
                <input type="hidden" name="status" value={action.value} />
                <button
                  type="submit"
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition",
                    action.value === "suspended"
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : action.value === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {action.label}
                </button>
              </form>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Briefcase} label="Jobs completed" value={String(cleaner.jobsCompleted)} />
          <StatTile
            icon={Star}
            label="Rating"
            value={cleaner.rating > 0 ? `${cleaner.rating.toFixed(1)} / 5` : "New"}
          />
          <StatTile icon={CalendarClock} label="Last booking" value={formatDate(cleaner.lastBookingDate)} />
          <StatTile
            icon={CalendarClock}
            label="Tenure"
            value={`${cleaner.tenure_months} mo${cleaner.tenure_months === 1 ? "" : "s"}`}
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card id="edit" className="scroll-mt-24 border-slate-200 bg-white p-5 text-slate-950 sm:p-6">
          <h3 className="text-lg font-bold">Edit cleaner</h3>
          <form action={updateCleanerAction} className="mt-4 grid gap-4">
            <input type="hidden" name="cleanerId" value={cleaner.id} />
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <ProfileInput label="Full name" name="fullName" defaultValue={cleaner.full_name ?? ""} required />
              <ProfileInput label="Display name" name="displayName" defaultValue={cleaner.display_name ?? ""} required />
            </div>
            <CleanerPhoneField defaultValue={phone} />
            <ProfileInput
              label="Service areas"
              name="suburbs"
              defaultValue={cleaner.suburbs.join(", ")}
              placeholder="Sea Point, Claremont"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <ProfileSelect label="Active" name="active" defaultValue={cleaner.active ? "true" : "false"} />
              <ProfileSelect label="Available" name="available" defaultValue={cleaner.available ? "true" : "false"} />
              <ProfileSelect
                label="Equipment"
                name="equipmentEligible"
                defaultValue={cleaner.equipment_eligible ? "true" : "false"}
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800"
            >
              Save changes
            </button>
          </form>
        </Card>

        <Card id="password" className="scroll-mt-24 border-slate-200 bg-white p-5 text-slate-950 sm:p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <KeyRound className="h-5 w-5 text-slate-400" />
            {cleaner.password_set_at ? "Reset password" : "Set password"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {cleaner.password_set_at
              ? `Password last set ${formatDate(cleaner.password_set_at.slice(0, 10))}.`
              : "This cleaner does not have a password yet."}
          </p>
          <form action={resetCleanerPasswordAction} className="mt-4 grid max-w-md gap-4">
            <input type="hidden" name="cleanerId" value={cleaner.id} />
            <ProfileInput
              label="New password"
              name="password"
              type="password"
              minLength={6}
              autoComplete="new-password"
              required
            />
            <button
              type="submit"
              className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              {cleaner.password_set_at ? "Reset password" : "Set password"}
            </button>
          </form>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white p-5 text-slate-950 sm:p-6">
        <h3 className="text-lg font-bold">Booking history</h3>
        {bookings.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No bookings recorded for this cleaner yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Suburb</th>
                  <th className="px-4 py-3">Booking status</th>
                  <th className="px-4 py-3">Assignment</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-600">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function BookingRow({ booking }: { booking: AdminCleanerBooking }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 text-slate-700">{formatDate(booking.bookingDate)}</td>
      <td className="px-4 py-3 text-slate-600">{booking.bookingTime}</td>
      <td className="px-4 py-3 text-slate-600">{booking.suburb}</td>
      <td className="px-4 py-3 text-slate-600">{slugToTitle(booking.status)}</td>
      <td className="px-4 py-3 text-slate-600">{slugToTitle(booking.offerStatus)}</td>
      <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatZar(booking.finalTotalCents)}</td>
    </tr>
  );
}

function ProfileInput({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
        {...props}
      />
    </label>
  );
}

function ProfileSelect({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}
