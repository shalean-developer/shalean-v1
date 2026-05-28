import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { AdminPricingManager } from "@/components/admin/AdminPricingManager";
import { loadAdminPricingData } from "@/lib/admin/data";

export default async function AdminPricingPage() {
  const data = await loadAdminPricingData();

  return (
    <>
      <AdminPageHeading eyebrow="Pricing" title="Pricing management">
        Manage Regular Cleaning service prices, room rules, add-ons, equipment, and prepaid recurring rules in ZAR.
      </AdminPageHeading>
      <AdminPricingManager data={data} />
    </>
  );
}
