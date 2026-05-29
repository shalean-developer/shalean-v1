"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  KeyRound,
  MoreVertical,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Star,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { setCleanerStatusAction } from "@/lib/admin/actions";
import {
  CLEANER_STATUS_META,
  countCleanerStatuses,
  deriveCleanerStatus,
  type CleanerStatus,
} from "@/lib/admin/cleaner-status";
import type { CleanerDirectoryRow } from "@/lib/admin/data";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type FilterValue = "all" | CleanerStatus;

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "pending", label: "Pending" },
];

function cleanerName(cleaner: CleanerDirectoryRow) {
  return cleaner.display_name ?? cleaner.full_name ?? "Unnamed cleaner";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

export function CleanerDirectory({ cleaners }: { cleaners: CleanerDirectoryRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(1);

  const statusCounts = useMemo(() => countCleanerStatuses(cleaners), [cleaners]);

  const withStatus = useMemo(
    () => cleaners.map((cleaner) => ({ cleaner, status: deriveCleanerStatus(cleaner) })),
    [cleaners],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return withStatus.filter(({ cleaner, status }) => {
      if (filter !== "all" && status !== filter) return false;
      if (!term) return true;
      const haystack = [
        cleaner.full_name,
        cleaner.display_name,
        cleaner.auth_email,
        cleaner.phone,
        cleaner.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [withStatus, filter, query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const handleFilterChange = (value: FilterValue) => {
    setFilter(value);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : start + 1;
  const rangeEnd = Math.min(start + PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total cleaners" value={cleaners.length} icon={Users} accent="text-slate-700" />
        <StatCard label="Active" value={statusCounts.active} icon={CheckCircle2} accent="text-emerald-600" />
        <StatCard label="Inactive" value={statusCounts.inactive} icon={PauseCircle} accent="text-slate-500" />
        <StatCard label="Suspended" value={statusCounts.suspended} icon={XCircle} accent="text-red-600" />
        <StatCard label="Pending" value={statusCounts.pending} icon={Clock} accent="text-amber-600" />
      </section>

      <Card className="border-slate-200 bg-white p-4 text-slate-950 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Cleaner directory</h2>
            <p className="mt-1 text-sm text-slate-500">Search, filter, and manage every cleaner account.</p>
          </div>
          <Link
            href="/admin/cleaners/new"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Add Cleaner
          </Link>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-emerald-500">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Search by name, email, phone, or cleaner ID..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((tab) => {
            const count = tab.value === "all" ? cleaners.length : statusCounts[tab.value];
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleFilterChange(tab.value)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-bold",
                    active ? "bg-emerald-200/70 text-emerald-900" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasCleaners={cleaners.length > 0} />
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Th>Cleaner</Th>
                    <Th>Phone</Th>
                    <Th>Email</Th>
                    <Th className="text-center">Jobs</Th>
                    <Th className="text-center">Rating</Th>
                    <Th>Last booking</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(({ cleaner, status }) => (
                    <tr key={cleaner.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/admin/cleaners/${cleaner.id}`} className="flex items-center gap-3 group">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                            {cleanerName(cleaner).charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-900 group-hover:text-emerald-700 group-hover:underline">
                              {cleanerName(cleaner)}
                            </span>
                            <span className="block truncate text-xs text-slate-400">{cleaner.full_name ?? "—"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{cleaner.phone || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="block max-w-[200px] truncate">{cleaner.auth_email ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">{cleaner.jobsCompleted}</td>
                      <td className="px-4 py-3">
                        <RatingValue rating={cleaner.rating} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(cleaner.lastBookingDate)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CleanerActionsMenu cleanerId={cleaner.id} status={status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 lg:hidden">
              {pageItems.map(({ cleaner, status }) => (
                <div key={cleaner.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/admin/cleaners/${cleaner.id}`} className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                        {cleanerName(cleaner).charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">{cleanerName(cleaner)}</span>
                        <span className="block truncate text-xs text-slate-500">{cleaner.auth_email ?? "—"}</span>
                      </span>
                    </Link>
                    <CleanerActionsMenu cleanerId={cleaner.id} status={status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <StatusBadge status={status} />
                    <RatingValue rating={cleaner.rating} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <MobileField label="Phone" value={cleaner.phone || "—"} />
                    <MobileField label="Jobs done" value={String(cleaner.jobsCompleted)} />
                    <MobileField label="Last booking" value={formatDate(cleaner.lastBookingDate)} />
                  </dl>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-700">{rangeStart}</span>–
                <span className="font-semibold text-slate-700">{rangeEnd}</span> of{" "}
                <span className="font-semibold text-slate-700">{filtered.length}</span> cleaners
              </p>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onChange={(next) => setPage(next)}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-semibold", className)}>{children}</th>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <Card className="border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50", accent)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: CleanerStatus }) {
  const meta = CLEANER_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
        meta.badgeClass,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}

function RatingValue({ rating }: { rating: number }) {
  if (!rating || rating <= 0) {
    return <span className="text-xs text-slate-400">New</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {rating.toFixed(1)}
    </span>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function EmptyState({ hasCleaners }: { hasCleaners: boolean }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <UserRound className="h-6 w-6" />
      </span>
      <p className="mt-4 text-base font-semibold text-slate-700">No cleaners found</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {hasCleaners
          ? "No cleaners match your current search or filter. Try adjusting them."
          : "Get started by adding your first cleaner to the directory."}
      </p>
      <Link
        href="/admin/cleaners/new"
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800"
      >
        <Plus className="h-4 w-4" />
        Add Cleaner
      </Link>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = pageNumbers(currentPage, totalPages);

  return (
    <div className="flex items-center gap-1">
      <PaginationButton
        ariaLabel="Previous page"
        disabled={currentPage <= 1}
        onClick={() => onChange(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </PaginationButton>
      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition",
              item === currentPage
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {item}
          </button>
        ),
      )}
      <PaginationButton
        ariaLabel="Next page"
        disabled={currentPage >= totalPages}
        onClick={() => onChange(currentPage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </PaginationButton>
    </div>
  );
}

function PaginationButton({
  children,
  disabled,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function pageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push("ellipsis");
  for (let page = left; page <= right; page += 1) pages.push(page);
  if (right < total - 1) pages.push("ellipsis");
  pages.push(total);

  return pages;
}

function CleanerActionsMenu({ cleanerId, status }: { cleanerId: string; status: CleanerStatus }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 208;
    setCoords({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (
        menuRef.current?.contains(event.target as Node) ||
        buttonRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleScroll() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Cleaner actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ position: "fixed", top: coords.top, left: coords.left, width: 208 }}
              className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            >
              <MenuLink href={`/admin/cleaners/${cleanerId}`} icon={UserRound} onSelect={() => setOpen(false)}>
                View Profile
              </MenuLink>
              <MenuLink href={`/admin/cleaners/${cleanerId}#edit`} icon={Pencil} onSelect={() => setOpen(false)}>
                Edit Cleaner
              </MenuLink>
              <MenuLink href={`/admin/cleaners/${cleanerId}#password`} icon={KeyRound} onSelect={() => setOpen(false)}>
                Reset Password
              </MenuLink>
              <div className="my-1 border-t border-slate-100" />
              {status !== "active" ? (
                <StatusActionItem cleanerId={cleanerId} status="active" icon={PlayCircle} label="Activate" />
              ) : null}
              {status !== "inactive" ? (
                <StatusActionItem cleanerId={cleanerId} status="inactive" icon={PauseCircle} label="Deactivate" />
              ) : null}
              {status !== "suspended" ? (
                <StatusActionItem
                  cleanerId={cleanerId}
                  status="suspended"
                  icon={XCircle}
                  label="Suspend"
                  danger
                />
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onSelect,
}: {
  href: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 text-slate-400" />
      {children}
    </Link>
  );
}

function StatusActionItem({
  cleanerId,
  status,
  icon: Icon,
  label,
  danger,
}: {
  cleanerId: string;
  status: "active" | "inactive" | "suspended";
  icon: typeof PlayCircle;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={setCleanerStatusAction}>
      <input type="hidden" name="cleanerId" value={cleanerId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        role="menuitem"
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition hover:bg-slate-50",
          danger ? "text-red-600 hover:bg-red-50" : "text-slate-700",
        )}
      >
        <Icon className={cn("h-4 w-4", danger ? "text-red-500" : "text-slate-400")} />
        {label}
      </button>
    </form>
  );
}
