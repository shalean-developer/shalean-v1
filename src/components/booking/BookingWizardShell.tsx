"use client";

import dynamic from "next/dynamic";

const BookingWizard = dynamic(
  () => import("./BookingWizard").then((module) => module.BookingWizard),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm">
        Loading booking flow...
      </div>
    ),
  },
);

export function BookingWizardShell() {
  return <BookingWizard />;
}
