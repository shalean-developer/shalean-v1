import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatZar } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cleaner Workspace | Shalean",
};

export default function CleanerPage() {
  const offers = [
    ["Regular Cleaning", "Sea Point", 30000],
    ["Airbnb Cleaning", "Green Point", 25000],
    ["Deep Cleaning Team", "Claremont", 25000],
  ];

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Badge>Cleaner platform</Badge>
        <h1 className="mt-3 text-3xl font-black">Offers, availability, and earnings</h1>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_340px]">
          <section className="grid gap-4">
            {offers.map(([service, suburb, payout]) => (
              <Card key={String(service)} className="p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-lg font-bold">{service}</h2>
                    <p className="mt-1 text-sm text-slate-600">{suburb} · payout validated before offer</p>
                  </div>
                  <span className="text-lg font-bold text-emerald-800">{formatZar(Number(payout))}</span>
                </div>
              </Card>
            ))}
          </section>
          <Card className="p-5">
            <h2 className="text-lg font-bold">Verification checklist</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {["Identity", "Background checks", "Training", "Bank details", "Availability"].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <span>{item}</span>
                  <Badge>Ready</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
