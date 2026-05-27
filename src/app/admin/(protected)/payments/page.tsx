import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/AdminLayoutShell";
import { PaymentSection } from "@/components/admin/AdminControls";
import { loadAdminPayments, type AdminPaymentStatusFilter } from "@/lib/admin/data";
import { loadAdminDashboard } from "@/lib/dashboard/data";

export const metadata: Metadata = {
  title: "Admin Payments | Shalean",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = normalizeStatusFilter(getParam(params, "status"));
  const [payments, dashboard] = await Promise.all([
    loadAdminPayments(status),
    loadAdminDashboard(),
  ]);

  return (
    <>
      <AdminPageHeading eyebrow="Payment section" title="Payments and payouts">
        Filter payment records by status and keep payout-ready totals visible for finance checks.
      </AdminPageHeading>
      <section>
        <PaymentSection payments={payments} payoutReadyCents={dashboard.stats.payoutReadyCents} activeFilter={status} />
      </section>
    </>
  );
}

function normalizeStatusFilter(value: string | undefined): AdminPaymentStatusFilter {
  return value === "paid" || value === "pending" || value === "refunded" ? value : "all";
}

function getParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}
