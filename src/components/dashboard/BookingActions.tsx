"use client";

import { CalendarClock, Download, Star, XCircle } from "lucide-react";

type BookingActionsProps = {
  canManage: boolean;
  isCompleted: boolean;
  paymentPaid: boolean;
  rescheduleHref: string;
  cancelHref: string;
  reviewHref: string;
};

export function BookingActions({
  canManage,
  isCompleted,
  paymentPaid,
  rescheduleHref,
  cancelHref,
  reviewHref,
}: BookingActionsProps) {
  const hasAnyAction = canManage || isCompleted || paymentPaid;

  if (!hasAnyAction) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        No actions are available for this booking right now.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {canManage ? (
        <a
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          href={rescheduleHref}
          target="_blank"
          rel="noreferrer"
        >
          <CalendarClock className="h-4 w-4" aria-hidden />
          Reschedule booking
        </a>
      ) : null}

      {canManage ? (
        <a
          className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50"
          href={cancelHref}
          target="_blank"
          rel="noreferrer"
        >
          <XCircle className="h-4 w-4" aria-hidden />
          Cancel booking
        </a>
      ) : null}

      {paymentPaid ? (
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          Download invoice
        </button>
      ) : null}

      {isCompleted ? (
        <a
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
          href={reviewHref}
          target="_blank"
          rel="noreferrer"
        >
          <Star className="h-4 w-4" aria-hidden />
          Leave a review
        </a>
      ) : null}
    </div>
  );
}
