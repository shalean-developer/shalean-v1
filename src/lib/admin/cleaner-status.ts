export type CleanerStatus = "active" | "inactive" | "suspended" | "pending";

export type CleanerStatusFlagsInput = {
  active: boolean;
  available: boolean;
  password_set_at: string | null;
};

/**
 * Derive a presentation status from the existing cleaner schema fields. The
 * database only stores `active` / `available` booleans plus `password_set_at`,
 * so the four operational statuses are mapped onto those fields:
 *
 * - pending   → no password set yet (account created, awaiting credentials)
 * - active    → active flag is on
 * - suspended → deactivated AND marked unavailable
 * - inactive  → deactivated but still available
 */
export function deriveCleanerStatus(cleaner: CleanerStatusFlagsInput): CleanerStatus {
  if (!cleaner.password_set_at) {
    return "pending";
  }

  if (cleaner.active) {
    return "active";
  }

  return cleaner.available ? "inactive" : "suspended";
}

/**
 * Map an actionable status (the ones an admin can set from the actions menu)
 * back to the `active` / `available` flags persisted in the cleaners table.
 */
export function cleanerStatusToFlags(
  status: "active" | "inactive" | "suspended",
): { active: boolean; available: boolean } {
  switch (status) {
    case "active":
      return { active: true, available: true };
    case "inactive":
      return { active: false, available: true };
    case "suspended":
      return { active: false, available: false };
  }
}

export const CLEANER_STATUS_ORDER: CleanerStatus[] = [
  "active",
  "inactive",
  "suspended",
  "pending",
];

export const CLEANER_STATUS_META: Record<
  CleanerStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  active: {
    label: "Active",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    dotClass: "bg-amber-500",
  },
  suspended: {
    label: "Suspended",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
    dotClass: "bg-red-500",
  },
  inactive: {
    label: "Inactive",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-600",
    dotClass: "bg-slate-400",
  },
};

export function countCleanerStatuses(
  cleaners: CleanerStatusFlagsInput[],
): Record<CleanerStatus, number> {
  const counts: Record<CleanerStatus, number> = {
    active: 0,
    inactive: 0,
    suspended: 0,
    pending: 0,
  };

  for (const cleaner of cleaners) {
    counts[deriveCleanerStatus(cleaner)] += 1;
  }

  return counts;
}
