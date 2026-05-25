import type { Metadata } from "next";
import { BookingWizardShell } from "@/components/booking/BookingWizardShell";

export const metadata: Metadata = {
  title: "Book Cleaning | Shalean Cleaning Services",
  description: "Book regular, deep, Airbnb, move in/out, carpet, or office cleaning in Cape Town with live pricing.",
};

export default function BookPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Persistent booking flow</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">Book a Shalean clean</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Nine-step mobile-first flow with saved progress, dynamic pricing, cleaner/team estimation, add-ons, recurring booking support, and production validation.
          </p>
        </div>
        <BookingWizardShell />
      </div>
    </main>
  );
}
