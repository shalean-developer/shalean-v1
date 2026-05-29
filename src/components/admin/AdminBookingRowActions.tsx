"use client";

import type React from "react";
import { useState } from "react";
import {
  CheckCircle2,
  ClipboardCopy,
  CreditCard,
  FileText,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
   XCircle,
} from "lucide-react";
import {
  checkPaymentStatusAction,
  createInvoiceAction,
  markBookingPaidAction,
  markBookingUnpaidAction,
  recordManualPaymentAction,
  retryZohoSyncAction,
  sendPaymentLinkAction,
  voidInvoiceAction,
} from "@/lib/admin/actions";
import { ADMIN_PAYMENT_METHODS } from "@/lib/admin/billing";
import type { AdminBookingListItem } from "@/lib/admin/data";
import { formatZar } from "@/lib/utils";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paystack: "Paystack",
  eft: "EFT / Bank transfer",
  cash: "Cash",
  card: "Card machine (POS)",
  corporate: "Corporate account",
  other: "Other",
};

const buttonClass =
  "inline-flex w-full items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50";

export function AdminBookingRowActions({ booking }: { booking: AdminBookingListItem }) {
  const paymentStatus = booking.payment?.status ?? booking.payment_status;
  const isPaid = paymentStatus === "paid";
  const hasInvoice = Boolean(booking.zoho_invoice_id);
  const zohoFailed = booking.zoho_sync_status === "failed";
  const paymentUrl = booking.paystack_authorization_url ?? "";

  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function copyLink() {
    if (!paymentUrl) return;
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex w-[170px] flex-col gap-1.5">
      {isPaid ? (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Paid
        </span>
      ) : null}

      {!isPaid && !hasInvoice && !zohoFailed ? (
        <ActionForm action={createInvoiceAction} bookingId={booking.id}>
          <FileText className="h-3.5 w-3.5" /> Create invoice
        </ActionForm>
      ) : null}

      {zohoFailed ? (
        <ActionForm action={retryZohoSyncAction} bookingId={booking.id}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry Zoho sync
        </ActionForm>
      ) : null}

      {!isPaid && hasInvoice ? (
        <>
          <ActionForm action={sendPaymentLinkAction} bookingId={booking.id}>
            {paymentUrl ? <Send className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {paymentUrl ? "Resend payment link" : "Send payment link"}
          </ActionForm>
          {paymentUrl ? (
            <button type="button" className={buttonClass} onClick={copyLink}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy payment link"}
            </button>
          ) : null}
          <ActionForm action={checkPaymentStatusAction} bookingId={booking.id}>
            <RefreshCw className="h-3.5 w-3.5" /> Check payment status
          </ActionForm>
        </>
      ) : null}

      {!isPaid ? (
        <button type="button" className={`${buttonClass} border-emerald-300 text-emerald-700`} onClick={() => setModalOpen(true)}>
          <CreditCard className="h-3.5 w-3.5" /> Record payment
        </button>
      ) : null}

      <details className="rounded-md border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-slate-600">Overrides</summary>
        <div className="flex flex-col gap-1.5 p-1.5">
          {!isPaid ? (
            <ConfirmActionForm
              action={markBookingPaidAction}
              bookingId={booking.id}
              confirmMessage="Mark this booking as fully paid?"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark as paid
            </ConfirmActionForm>
          ) : (
            <ConfirmActionForm
              action={markBookingUnpaidAction}
              bookingId={booking.id}
              confirmMessage="Reset this booking to unpaid?"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Mark as unpaid
            </ConfirmActionForm>
          )}
          {hasInvoice ? (
            <ConfirmActionForm
              action={voidInvoiceAction}
              bookingId={booking.id}
              confirmMessage="Void the Zoho invoice for this booking?"
            >
              <XCircle className="h-3.5 w-3.5" /> Void invoice
            </ConfirmActionForm>
          ) : null}
        </div>
      </details>

      {modalOpen ? (
        <RecordPaymentModal booking={booking} onClose={() => setModalOpen(false)} />
      ) : null}
    </div>
  );
}

function ActionForm({
  action,
  bookingId,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  bookingId: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <button type="submit" className={buttonClass}>
        {children}
      </button>
    </form>
  );
}

function ConfirmActionForm({
  action,
  bookingId,
  confirmMessage,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  bookingId: string;
  confirmMessage: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <button type="submit" className={buttonClass}>
        {children}
      </button>
    </form>
  );
}

function RecordPaymentModal({
  booking,
  onClose,
}: {
  booking: AdminBookingListItem;
  onClose: () => void;
}) {
  const dueCents = booking.amount_due_cents ?? booking.series_total_cents ?? booking.final_total_cents;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">Record payment</h3>
            <p className="mt-1 text-sm text-slate-600">
              {booking.customer?.full_name ?? "Customer"} • {formatZar(dueCents)} due
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form action={recordManualPaymentAction} className="mt-4 grid gap-3" onSubmit={onClose}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-700">Amount paid (ZAR)</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={(dueCents / 100).toFixed(2)}
              className="min-h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-700">Payment method</span>
            <select
              name="paymentMethod"
              required
              defaultValue="eft"
              className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500"
            >
              {ADMIN_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method] ?? method}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-700">Payment date</span>
            <input
              name="paymentDate"
              type="date"
              required
              defaultValue={today}
              className="min-h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-700">Reference number (optional)</span>
            <input
              name="reference"
              className="min-h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-700">Internal notes (optional)</span>
            <textarea
              name="notes"
              className="min-h-16 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="sendConfirmation" defaultChecked />
            Email the customer a payment confirmation
          </label>
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Record payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
