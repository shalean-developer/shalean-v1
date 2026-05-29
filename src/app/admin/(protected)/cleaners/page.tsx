import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { CleanerDirectory } from "@/components/admin/CleanerDirectory";
import { loadAdminCleanerDirectory } from "@/lib/admin/data";

export const metadata: Metadata = {
  title: "Admin Cleaners | Shalean",
};

export const dynamic = "force-dynamic";

export default async function AdminCleanersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const [{ cleaners }, params] = await Promise.all([loadAdminCleanerDirectory(), searchParams]);

  return (
    <>
      <AdminPageHeading eyebrow="Cleaner section" title="Cleaner management">
        Monitor your workforce, manage accounts, and onboard new cleaners. Phone-generated login emails and passwords stay
        controlled through explicit actions.
      </AdminPageHeading>
      {params.success === "cleaner-created" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Cleaner created successfully.
        </div>
      ) : null}
      <CleanerDirectory cleaners={cleaners} />
    </>
  );
}
