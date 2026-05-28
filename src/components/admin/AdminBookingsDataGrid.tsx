"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AdminBookingListItem, CleanerRow } from "@/lib/admin/data";
import { formatZar, slugToTitle } from "@/lib/utils";

const PAGE_SIZE = 12;

export function AdminBookingsDataGrid({
  bookings,
  cleaners,
}: {
  bookings: AdminBookingListItem[];
  cleaners: CleanerRow[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cleanerFilter, setCleanerFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);

  const cleanersById = useMemo(
    () => new Map(cleaners.map((cleaner) => [cleaner.id, cleaner.display_name ?? cleaner.full_name ?? cleaner.phone ?? cleaner.id])),
    [cleaners],
  );

  const statusOptions = useMemo(
    () => ["all", ...Array.from(new Set(bookings.map((booking) => booking.booking_status)))],
    [bookings],
  );
  const paymentOptions = useMemo(
    () => ["all", ...Array.from(new Set(bookings.map((booking) => booking.payment?.status ?? booking.payment_status)))],
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const cleanerId = booking.selected_cleaner_id ?? "";
      const cleanerName = cleanerId ? cleanersById.get(cleanerId) ?? "Cleaner unavailable" : "Unassigned";
      const paymentStatus = booking.payment?.status ?? booking.payment_status;

      if (statusFilter !== "all" && booking.booking_status !== statusFilter) return false;
      if (paymentFilter !== "all" && paymentStatus !== paymentFilter) return false;
      if (cleanerFilter === "unassigned" && cleanerId) return false;
      if (cleanerFilter !== "all" && cleanerFilter !== "unassigned" && cleanerId !== cleanerFilter) return false;
      if (dateFilter && booking.booking_date !== dateFilter) return false;

      if (!normalizedSearch) return true;

      const searchable = [
        booking.id,
        booking.customer?.full_name ?? "",
        booking.customer?.email ?? "",
        booking.address,
        booking.suburb,
        booking.service_slug,
        cleanerName,
      ].join(" ").toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [bookings, cleanerFilter, cleanersById, dateFilter, paymentFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedBookings = filteredBookings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-xl font-bold">Recent bookings</h3>
          <p className="mt-1 text-sm text-slate-600">
            Includes bookings created through customer checkout and admin booking creation.
          </p>
        </div>
        <div className="text-sm text-slate-600">
          Showing {paginatedBookings.length} of {filteredBookings.length} filtered bookings
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="xl:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search</span>
          <div className="mt-2 flex items-center rounded-md border border-slate-300 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="min-h-10 w-full bg-transparent px-2 text-sm text-slate-900 outline-none"
              placeholder="Customer, address, suburb, booking ID"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </label>
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Cleaner"
          value={cleanerFilter}
          options={[
            "all",
            "unassigned",
            ...cleaners.map((cleaner) => cleaner.id),
          ]}
          onChange={(value) => {
            setCleanerFilter(value);
            setPage(1);
          }}
          formatLabel={(value) => {
            if (value === "all") return "All";
            if (value === "unassigned") return "Unassigned";
            return cleanersById.get(value) ?? value;
          }}
        />
        <FilterSelect
          label="Payment"
          value={paymentFilter}
          options={paymentOptions}
          onChange={(value) => {
            setPaymentFilter(value);
            setPage(1);
          }}
        />
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Date</span>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500"
            type="date"
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <div className="mt-4 hidden md:block">
        <div className="max-h-[540px] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Customer & location</th>
                <th className="px-4 py-3 text-left font-semibold">Schedule</th>
                <th className="px-4 py-3 text-left font-semibold">Service</th>
                <th className="px-4 py-3 text-left font-semibold">Cleaner</th>
                <th className="px-4 py-3 text-left font-semibold">Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedBookings.length > 0 ? paginatedBookings.map((booking) => {
                const cleanerName = booking.selected_cleaner_id ? cleanersById.get(booking.selected_cleaner_id) ?? "Cleaner unavailable" : "Auto-assign";
                const paymentStatus = booking.payment?.status ?? booking.payment_status;

                return (
                  <tr key={booking.id} className="bg-transparent transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{booking.customer?.full_name ?? "Customer unavailable"}</p>
                      <p className="mt-1 text-xs text-slate-500">{booking.address}, {booking.suburb}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{booking.booking_date}</p>
                      <p className="text-xs text-slate-500">{booking.booking_time}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{slugToTitle(booking.service_slug)}</td>
                    <td className="px-4 py-3 text-slate-700">{cleanerName}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatZar(booking.final_total_cents)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill value={booking.booking_status} tone="booking" />
                        <StatusPill value={paymentStatus} tone="payment" />
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>No bookings match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 space-y-3 md:hidden">
        {paginatedBookings.length > 0 ? paginatedBookings.map((booking) => {
          const cleanerName = booking.selected_cleaner_id ? cleanersById.get(booking.selected_cleaner_id) ?? "Cleaner unavailable" : "Auto-assign";
          const paymentStatus = booking.payment?.status ?? booking.payment_status;

          return (
            <article key={booking.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{booking.customer?.full_name ?? "Customer unavailable"}</p>
                  <p className="mt-1 text-xs text-slate-500">{booking.address}, {booking.suburb}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatZar(booking.final_total_cents)}</p>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-slate-600">
                <p>{booking.booking_date} • {booking.booking_time}</p>
                <p>{slugToTitle(booking.service_slug)} • {cleanerName}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusPill value={booking.booking_status} tone="booking" />
                <StatusPill value={paymentStatus} tone="payment" />
              </div>
            </article>
          );
        }) : <p className="text-sm text-slate-500">No bookings match these filters.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-600">Page {currentPage} of {totalPages}</p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
            type="button"
            onClick={() => setPage((current) => Math.max(1, Math.min(totalPages, current) - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, Math.min(totalPages, current) + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  formatLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  formatLabel?: (value: string) => string;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <select
        className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {formatLabel ? formatLabel(option) : option === "all" ? "All" : slugToTitle(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({ value, tone }: { value: string; tone: "booking" | "payment" }) {
  const base = tone === "booking"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const cancelled = value === "cancelled" || value === "refunded";
  const pending = value === "pending" || value === "offered" || value === "awaiting_payment";

  return (
    <Badge
      className={cancelled
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : pending
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : base}
    >
      {slugToTitle(value)}
    </Badge>
  );
}
