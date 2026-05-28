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
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Book a Shalean clean</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Book your clean in a few simple steps. Your price updates automatically as you choose your details.
          </p>
        </div>
        <BookingWizardShell />
      </div>
    </main>
  );
}
