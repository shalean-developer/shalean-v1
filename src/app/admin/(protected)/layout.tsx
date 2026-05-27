import type React from "react";
import { AdminLayoutShell } from "@/components/admin/AdminLayoutShell";
import { requireAdmin } from "@/lib/auth/server";
import { loadAdminDashboard } from "@/lib/dashboard/data";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  const dashboard = await loadAdminDashboard();

  return (
    <AdminLayoutShell adminName={profile.full_name} stats={dashboard.stats}>
      {children}
    </AdminLayoutShell>
  );
}
