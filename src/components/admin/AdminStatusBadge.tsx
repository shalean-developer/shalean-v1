"use client";

import { Badge } from "@/components/ui/badge";
import { describeAdminStatus, type StatusBadgeKind } from "@/lib/admin/status-labels";
import { cn } from "@/lib/utils";

function toneForStatus(kind: StatusBadgeKind, value: string) {
  const normalized = value.toLowerCase();

  if (kind === "booking") {
    if (normalized === "cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
    if (normalized === "payment_pending" || normalized === "draft") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    if (normalized === "assigned" || normalized === "in_progress") {
      return "border-violet-200 bg-violet-50 text-violet-700";
    }
    if (normalized === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (kind === "payment") {
    if (normalized === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (normalized === "failed" || normalized === "refunded") {
      return "border-rose-200 bg-rose-50 text-rose-700";
    }
    if (normalized === "partially_paid") return "border-amber-200 bg-amber-50 text-amber-800";
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (kind === "invoice") {
    if (normalized === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (normalized === "voided") return "border-rose-200 bg-rose-50 text-rose-700";
    if (normalized === "created") return "border-sky-200 bg-sky-50 text-sky-700";
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "synced") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "skipped") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function AdminStatusBadge({
  kind,
  value,
  className,
}: {
  kind: StatusBadgeKind;
  value: string | null | undefined;
  className?: string;
}) {
  const { label, tooltip } = describeAdminStatus(kind, value);
  const raw = (value ?? "pending").trim().toLowerCase() || "pending";

  return (
    <Badge
      className={cn("cursor-help", toneForStatus(kind, raw), className)}
      title={tooltip}
    >
      {label}
    </Badge>
  );
}
