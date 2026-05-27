import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { CustomerFormCard, CustomerManagement } from "@/components/admin/AdminControls";
import { loadAdminManagementData } from "@/lib/admin/data";

export const metadata: Metadata = {
  title: "Admin Customers | Shalean",
};

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const management = await loadAdminManagementData();

  return (
    <>
      <AdminPageHeading eyebrow="Customer section" title="Customer profiles">
        Customer emails and phones are entered manually. Passwords are optional and only shown for explicit set/reset actions.
      </AdminPageHeading>
      <section className="grid gap-4 xl:grid-cols-[440px_1fr]">
        <CustomerFormCard />
        <CustomerManagement customers={management.customers} />
      </section>
    </>
  );
}
