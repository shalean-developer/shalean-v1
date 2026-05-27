import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { CleanerManagement, CreateCleanerCard } from "@/components/admin/AdminControls";
import { loadAdminManagementData } from "@/lib/admin/data";

export const metadata: Metadata = {
  title: "Admin Cleaners | Shalean",
};

export const dynamic = "force-dynamic";

export default async function AdminCleanersPage() {
  const management = await loadAdminManagementData();

  return (
    <>
      <AdminPageHeading eyebrow="Cleaner section" title="Cleaner accounts">
        Create cleaners, keep phone-generated emails consistent, and manage passwords only through explicit actions.
      </AdminPageHeading>
      <section className="grid gap-4 xl:grid-cols-[440px_1fr]">
        <CreateCleanerCard />
        <CleanerManagement cleaners={management.cleaners} />
      </section>
    </>
  );
}
