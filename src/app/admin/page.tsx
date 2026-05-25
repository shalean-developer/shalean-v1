import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { bookingTransitions } from "@/lib/booking/lifecycle";

export const metadata: Metadata = {
  title: "Admin Operations | Shalean",
};

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Badge className="border-teal-300 bg-teal-100 text-teal-900">Admin command center</Badge>
        <h1 className="mt-3 text-3xl font-black">Dispatch, finance, and lifecycle monitoring</h1>
        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {[
            ["Open bookings", "18"],
            ["Needs assignment", "6"],
            ["Payout ready", "R8,250"],
            ["Webhook events", "42"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/10 p-5">
              <p className="text-sm text-slate-300">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card className="border-white/10 bg-white p-5 text-slate-950">
            <h2 className="text-xl font-bold">Lifecycle engine</h2>
            <div className="mt-4 grid gap-3 text-sm">
              {Object.entries(bookingTransitions).map(([from, to]) => (
                <div key={from} className="rounded-md bg-slate-50 p-3">
                  <span className="font-semibold">{from}</span>
                  <span className="text-slate-500">{" -> "}{to.length ? to.join(", ") : "terminal"}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="border-white/10 bg-white p-5 text-slate-950">
            <h2 className="text-xl font-bold">Ops controls</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Manual booking creation and assignment overrides.</p>
              <p>Cleaner/team dispatch with audit trail rows.</p>
              <p>Pricing, payout, refund, and reconciliation queues.</p>
              <p>Customer management and SEO analytics views.</p>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
