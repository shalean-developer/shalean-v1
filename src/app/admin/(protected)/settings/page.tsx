import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { SettingsSection } from "@/components/admin/AdminControls";
import { requireAdmin } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Admin Settings | Shalean",
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { user, profile } = await requireAdmin();

  return (
    <>
      <AdminPageHeading eyebrow="Settings section" title="Security and route protection">
        Review the current admin identity, role source, route protection, and operational security warnings.
      </AdminPageHeading>
      <section>
        <SettingsSection adminName={profile.full_name} adminEmail={user.email} role={profile.role} />
      </section>
    </>
  );
}
