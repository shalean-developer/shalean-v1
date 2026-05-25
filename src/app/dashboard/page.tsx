import type { Metadata } from "next";
import type React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Customer Dashboard | Shalean",
};

export default function CustomerDashboardPage() {
  return (
    <DashboardShell title="Customer dashboard" eyebrow="Bookings and recurring services">
      <Card className="p-5">
        <Badge>Next clean</Badge>
        <h2 className="mt-4 text-xl font-bold">Regular Cleaning in Sea Point</h2>
        <p className="mt-2 text-sm text-slate-600">Tue 26 May, 08:00 - 12:00. Auto-assignment fallback is enabled.</p>
      </Card>
      <Card className="p-5">
        <h2 className="text-xl font-bold">Recurring plan</h2>
        <p className="mt-2 text-sm text-slate-600">Weekly schedule, Paystack checkout, saved address, and rescheduling workflow hooks.</p>
      </Card>
      <Card className="p-5">
        <h2 className="text-xl font-bold">Booking tracking</h2>
        <div className="mt-4 grid gap-2 text-sm text-slate-600">
          {["Paid", "Assignment pending", "Cleaner notified", "In progress", "Completed"].map((state, index) => (
            <div key={state} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />
              <span>{index + 1}. {state}</span>
            </div>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}

function DashboardShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">{children}</div>
      </div>
    </main>
  );
}
