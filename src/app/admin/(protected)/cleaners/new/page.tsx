import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { CleanerPhoneField } from "@/components/admin/CleanerPhoneField";
import { Card } from "@/components/ui/card";
import { createCleanerAction } from "@/lib/admin/actions";

export const metadata: Metadata = {
  title: "Add Cleaner | Shalean",
};

export const dynamic = "force-dynamic";

export default function NewCleanerPage() {
  return (
    <>
      <AdminPageHeading eyebrow="Cleaner section" title="Add a new cleaner">
        Capture the essentials to onboard a cleaner. Service areas, equipment eligibility, and other details can be managed
        later from the cleaner&apos;s profile.
      </AdminPageHeading>

      <Link
        href="/admin/cleaners"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cleaners
      </Link>

      <Card className="max-w-2xl border-slate-200 bg-white p-5 text-slate-950 sm:p-6">
        <form action={createCleanerAction} className="grid gap-4">
          <input type="hidden" name="redirectToList" value="true" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" name="firstName" autoComplete="given-name" required />
            <Field label="Last name" name="lastName" autoComplete="family-name" required />
          </div>
          <CleanerPhoneField label="Phone number" />
          <Field
            label="Temporary password"
            name="password"
            type="password"
            minLength={6}
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-slate-500">
            The cleaner&apos;s login email is generated automatically from their phone number (shown above).
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800"
            >
              Create cleaner
            </button>
            <Link
              href="/admin/cleaners"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}

function Field({
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
