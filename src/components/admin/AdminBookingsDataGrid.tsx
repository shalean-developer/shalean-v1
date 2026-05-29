"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AdminBookingRowActions } from "@/components/admin/AdminBookingRowActions";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Badge } from "@/components/ui/badge";
import type { AdminBookingListItem, CleanerRow } from "@/lib/admin/data";
import {
  bookingSourceFor,
  countNeedsAction,
  formatBookingReference,
  matchesBookingsTab,
  paymentStatusForBooking,
  type BookingsTab,
  type BookingSource,
} from "@/lib/admin/bookings-ui";
import { cn, formatZar, slugToTitle } from "@/lib/utils";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paystack: "Paystack",
  eft: "EFT",
  cash: "Cash",
  card: "Card",
  corporate: "Corporate",
  other: "Other",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

const TABS: Array<{ id: BookingsTab; label: string }> = [
  { id: "all", label: "All bookings" },
  { id: "needs_action", label: "Needs action" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminBookingsDataGrid({
  bookings,
  cleaners,
  adminCreatedBookingIds,
  activeTab,
  onTabChange,
  onViewBooking,
}: {
  bookings: AdminBookingListItem[];
  cleaners: CleanerRow[];
  adminCreatedBookingIds: ReadonlySet<string>;
  activeTab: BookingsTab;
  onTabChange: (tab: BookingsTab) => void;
  onViewBooking?: (booking: AdminBookingListItem) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [cleanerFilter, setCleanerFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | BookingSource>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const today = todayIso();
  const needsActionCount = useMemo(() => countNeedsAction(bookings, today), [bookings, today]);

  const cleanersById = useMemo(
    () =>
      new Map(
        cleaners.map((cleaner) => [
          cleaner.id,
          cleaner.display_name ?? cleaner.full_name ?? cleaner.phone ?? cleaner.id,
        ]),
      ),
    [cleaners],
  );

  const statusOptions = useMemo(
    () => ["all", ...Array.from(new Set(bookings.map((booking) => booking.booking_status)))],
    [bookings],
  );
  const paymentOptions = useMemo(
    () => ["all", ...Array.from(new Set(bookings.map((booking) => paymentStatusForBooking(booking))))],
    [bookings],
  );
  const invoiceOptions = useMemo(
    () => ["all", ...Array.from(new Set(bookings.map((booking) => booking.invoice_status ?? "pending")))],
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      if (!matchesBookingsTab(booking, activeTab, today)) return false;

      const cleanerId = booking.selected_cleaner_id ?? "";
      const cleanerName = cleanerId ? cleanersById.get(cleanerId) ?? "" : "";
      const paymentStatus = paymentStatusForBooking(booking);
      const source = bookingSourceFor(booking, adminCreatedBookingIds);
      const ref = formatBookingReference(booking).toLowerCase();

      if (statusFilter !== "all" && booking.booking_status !== statusFilter) return false;
      if (paymentFilter !== "all" && paymentStatus !== paymentFilter) return false;
      if (invoiceFilter !== "all" && (booking.invoice_status ?? "pending") !== invoiceFilter) return false;
      if (sourceFilter !== "all" && source !== sourceFilter) return false;
      if (cleanerFilter === "unassigned" && cleanerId) return false;
      if (cleanerFilter !== "all" && cleanerFilter !== "unassigned" && cleanerId !== cleanerFilter) return false;
      if (dateFilter && booking.booking_date !== dateFilter) return false;

      if (!normalizedSearch) return true;

      const searchable = [
        ref,
        booking.id,
        booking.customer?.full_name ?? "",
        booking.customer?.email ?? "",
        booking.customer?.phone ?? "",
        booking.address,
        booking.suburb,
        cleanerName,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [
    activeTab,
    adminCreatedBookingIds,
    bookings,
    cleanerFilter,
    cleanersById,
    dateFilter,
    invoiceFilter,
    paymentFilter,
    search,
    sourceFilter,
    statusFilter,
    today,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const rangeStart = filteredBookings.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredBookings.length);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setInvoiceFilter("all");
    setCleanerFilter("all");
    setSourceFilter("all");
    setDateFilter("");
    setPage(1);
  }

  const hasActiveFilters =
    search ||
    statusFilter !== "all" ||
    paymentFilter !== "all" ||
    invoiceFilter !== "all" ||
    cleanerFilter !== "all" ||
    sourceFilter !== "all" ||
    dateFilter;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onTabChange(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  activeTab === tab.id
                    ? "bg-emerald-700 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {tab.label}
                {tab.id === "needs_action" && needsActionCount > 0 ? (
                  <Badge className="border-rose-200 bg-rose-100 px-1.5 text-[10px] text-rose-700">
                    {needsActionCount}
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-end">
          <label className="min-w-[200px] flex-1 xl:min-w-[240px]">
            <span className="sr-only">Search</span>
            <div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                className="w-full bg-transparent px-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Customer, phone, booking ref, suburb…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </label>
          <CompactFilter label="Date">
            <input
              type="date"
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setPage(1);
              }}
            />
          </CompactFilter>
          <CompactFilter label="Booking status">
            <FilterSelect value={statusFilter} options={statusOptions} onChange={setStatusFilter} setPage={setPage} />
          </CompactFilter>
          <CompactFilter label="Payment status">
            <FilterSelect value={paymentFilter} options={paymentOptions} onChange={setPaymentFilter} setPage={setPage} />
          </CompactFilter>
          <CompactFilter label="Invoice status">
            <FilterSelect value={invoiceFilter} options={invoiceOptions} onChange={setInvoiceFilter} setPage={setPage} />
          </CompactFilter>
          <CompactFilter label="Cleaner">
            <select
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
              value={cleanerFilter}
              onChange={(event) => {
                setCleanerFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {cleaners.map((cleaner) => (
                <option key={cleaner.id} value={cleaner.id}>
                  {cleanersById.get(cleaner.id)}
                </option>
              ))}
            </select>
          </CompactFilter>
          <CompactFilter label="Source">
            <select
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value as "all" | BookingSource);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="online">Online</option>
              <option value="admin">Admin</option>
            </select>
          </CompactFilter>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-10 px-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="w-[11%] px-3 py-3">Booking ref</th>
                <th className="w-[14%] px-3 py-3">Customer</th>
                <th className="w-[10%] px-3 py-3">Date & time</th>
                <th className="w-[12%] px-3 py-3">Address</th>
                <th className="w-[11%] px-3 py-3">Cleaner</th>
                <th className="w-[8%] px-3 py-3">Amount</th>
                <th className="w-[11%] px-3 py-3">Payment</th>
                <th className="w-[12%] px-3 py-3">Invoice</th>
                <th className="w-[9%] px-3 py-3">Booking</th>
                <th className="w-[48px] px-2 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedBookings.length > 0 ? (
                paginatedBookings.map((booking) => (
                  <BookingTableRow
                    key={booking.id}
                    booking={booking}
                    cleanersById={cleanersById}
                    adminCreatedBookingIds={adminCreatedBookingIds}
                    onView={() => onViewBooking?.(booking)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-12">
                    <EmptyState onCreateHint={Boolean(onViewBooking)} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {paginatedBookings.length > 0 ? (
          paginatedBookings.map((booking) => (
            <MobileBookingCard
              key={booking.id}
              booking={booking}
              cleanersById={cleanersById}
              adminCreatedBookingIds={adminCreatedBookingIds}
              onView={() => onViewBooking?.(booking)}
            />
          ))
        ) : (
          <EmptyState />
        )}
      </div>

      <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p>
          Showing {rangeStart} to {rangeEnd} of {filteredBookings.length} bookings
        </p>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Per page</span>
          <select
            className="min-h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </footer>
    </div>
  );
}

function BookingTableRow({
  booking,
  cleanersById,
  adminCreatedBookingIds,
  onView,
}: {
  booking: AdminBookingListItem;
  cleanersById: Map<string, string>;
  adminCreatedBookingIds: ReadonlySet<string>;
  onView?: () => void;
}) {
  const paymentStatus = paymentStatusForBooking(booking);
  const ref = formatBookingReference(booking);
  const source = bookingSourceFor(booking, adminCreatedBookingIds);
  const cleanerName = booking.selected_cleaner_id
    ? cleanersById.get(booking.selected_cleaner_id) ?? "Unavailable"
    : null;

  return (
    <tr
      className="cursor-pointer transition hover:bg-slate-50/80"
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a, form, input, select, textarea, [role='dialog']")) return;
        onView?.();
      }}
    >
      <td className="px-3 py-3 align-top">
        <p className="truncate font-semibold text-slate-900" title={ref}>
          {ref}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">{source === "admin" ? "Admin" : "Online"}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="truncate font-semibold text-slate-900">{booking.customer?.full_name ?? "—"}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {booking.customer?.phone ?? booking.customer?.email ?? "—"}
        </p>
      </td>
      <td className="px-3 py-3 align-top text-slate-700">
        <p className="truncate">{booking.booking_date}</p>
        <p className="truncate text-xs text-slate-500">{booking.booking_time}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="line-clamp-2 text-xs text-slate-700" title={`${booking.address}, ${booking.suburb}`}>
          {booking.address}
        </p>
        <p className="truncate text-xs text-slate-500">{booking.suburb}</p>
      </td>
      <td className="px-3 py-3 align-top">
        {cleanerName ? (
          <p className="truncate text-sm text-slate-800">{cleanerName}</p>
        ) : (
          <Badge className="border-slate-200 bg-slate-100 text-slate-600">Unassigned</Badge>
        )}
      </td>
      <td className="px-3 py-3 align-top font-semibold text-slate-900">
        {formatZar(booking.final_total_cents)}
      </td>
      <td className="px-3 py-3 align-top">
        <PaymentCell booking={booking} paymentStatus={paymentStatus} />
      </td>
      <td className="px-3 py-3 align-top">
        <InvoiceCell booking={booking} />
      </td>
      <td className="px-3 py-3 align-top">
        <AdminStatusBadge kind="booking" value={booking.booking_status} />
      </td>
      <td className="px-2 py-3 align-top" onClick={(event) => event.stopPropagation()}>
        <AdminBookingRowActions booking={booking} onView={onView} />
      </td>
    </tr>
  );
}

function MobileBookingCard({
  booking,
  cleanersById,
  adminCreatedBookingIds,
  onView,
}: {
  booking: AdminBookingListItem;
  cleanersById: Map<string, string>;
  adminCreatedBookingIds: ReadonlySet<string>;
  onView?: () => void;
}) {
  const paymentStatus = paymentStatusForBooking(booking);
  const ref = formatBookingReference(booking);
  const source = bookingSourceFor(booking, adminCreatedBookingIds);
  const cleanerName = booking.selected_cleaner_id
    ? cleanersById.get(booking.selected_cleaner_id)
    : null;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <button type="button" className="w-full text-left" onClick={onView}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{booking.customer?.full_name ?? "Customer"}</p>
            <p className="text-xs text-slate-500">
              {ref} · {source === "admin" ? "Admin" : "Online"}
            </p>
          </div>
          <p className="shrink-0 text-sm font-bold text-slate-900">{formatZar(booking.final_total_cents)}</p>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {booking.booking_date} · {booking.booking_time}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {cleanerName ?? "Unassigned"} · {booking.suburb}
        </p>
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <AdminStatusBadge kind="booking" value={booking.booking_status} />
        <AdminStatusBadge kind="payment" value={paymentStatus} />
      </div>
      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
        <AdminBookingRowActions booking={booking} onView={onView} />
      </div>
    </article>
  );
}

function CompactFilter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="min-w-[120px] flex-1 xl:max-w-[160px]">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
  setPage,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  setPage: (page: number) => void;
}) {
  return (
    <select
      className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
        setPage(1);
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "all" ? "All" : slugToTitle(option)}
        </option>
      ))}
    </select>
  );
}

function PaymentCell({
  booking,
  paymentStatus,
}: {
  booking: AdminBookingListItem;
  paymentStatus: string;
}) {
  const method = booking.payment_method;
  const paid = booking.amount_paid_cents;
  const total = booking.final_total_cents;

  return (
    <div className="flex flex-col gap-1">
      <AdminStatusBadge kind="payment" value={paymentStatus} className="text-[10px]" />
      {method ? (
        <span className="truncate text-[11px] text-slate-500">
          {PAYMENT_METHOD_LABELS[method] ?? slugToTitle(method)}
        </span>
      ) : null}
      {paymentStatus !== "paid" && paid > 0 ? (
        <span className="text-[11px] text-slate-500">
          {formatZar(paid)} / {formatZar(total)}
        </span>
      ) : null}
      {paymentStatus === "partially_paid" && booking.balance_remaining_cents != null ? (
        <span className="text-[11px] text-amber-700">Bal. {formatZar(booking.balance_remaining_cents)}</span>
      ) : null}
    </div>
  );
}

function InvoiceCell({ booking }: { booking: AdminBookingListItem }) {
  const zohoStatus = booking.zoho_sync_status ?? "pending";

  return (
    <div className="flex flex-col gap-1">
      <AdminStatusBadge kind="invoice" value={booking.invoice_status ?? "pending"} className="text-[10px]" />
      <AdminStatusBadge kind="zoho" value={zohoStatus} className="text-[10px]" />
      {booking.zoho_invoice_number ? (
        <span className="truncate text-[11px] text-slate-500" title={booking.zoho_invoice_number}>
          {booking.zoho_invoice_number}
        </span>
      ) : null}
    </div>
  );
}

function EmptyState({ onCreateHint }: { onCreateHint?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-slate-800">No bookings found</p>
      <p className="mt-1 text-sm text-slate-500">
        {onCreateHint
          ? "Try changing filters or create a new booking."
          : "Try changing filters or create a new booking."}
      </p>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = buildPageList(currentPage, totalPages);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
      <PageButton disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        ‹
      </PageButton>
      {pages.map((page, index) =>
        page === "…" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <PageButton
            key={page}
            active={page === currentPage}
            onClick={() => onPageChange(page)}
          >
            {page}
          </PageButton>
        ),
      )}
      <PageButton disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
        ›
      </PageButton>
    </nav>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-semibold transition",
        active
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function buildPageList(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | "…"> = [1];
  if (current > 3) pages.push("…");
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
    pages.push(page);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
