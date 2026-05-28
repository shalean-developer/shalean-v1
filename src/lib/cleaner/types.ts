import type { CleanerDashboardJob } from "@/lib/dashboard/data";

/** UI lifecycle stage for a cleaner job card (maps from booking_cleaners.status). */
export type CleanerJobLifecycleMode = "offer" | "accepted" | "in_progress" | "completed";

export type CleanerNavItem = {
  href: string;
  label: string;
  icon: "dashboard" | "earnings" | "jobs" | "profile";
};

export type CleanerEarningsSummary = {
  todayCents: number;
  weekCents: number;
  monthCents: number;
  pendingCents: number;
  completedCount: number;
  recentPayouts: CleanerEarningsEntry[];
};

export type CleanerEarningsEntry = {
  id: string;
  label: string;
  date: string;
  amountCents: number;
  status: CleanerJobLifecycleMode | "declined";
};

export type CleanerProfileSummary = {
  id: string;
  name: string;
  photoUrl: string | null;
  phone: string | null;
  available: boolean;
  active: boolean;
  equipmentEligible: boolean;
  rating: number | null;
  tenureMonths: number | null;
  suburbs: string[];
  serviceSlugs: string[];
};

export function lifecycleModeFromOfferStatus(status: string): CleanerJobLifecycleMode | null {
  const map: Record<string, CleanerJobLifecycleMode> = {
    offered: "offer",
    accepted: "accepted",
    in_progress: "in_progress",
    completed: "completed",
  };
  return map[status] ?? null;
}

export function jobMatchesMode(job: CleanerDashboardJob, mode: CleanerJobLifecycleMode): boolean {
  return lifecycleModeFromOfferStatus(job.offer.status) === mode;
}
