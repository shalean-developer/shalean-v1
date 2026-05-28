import type { CleanerDashboardJob } from "@/lib/dashboard/data";
import type { CleanerEarningsEntry, CleanerEarningsSummary } from "@/lib/cleaner/types";
import { lifecycleModeFromOfferStatus } from "@/lib/cleaner/types";
import { slugToTitle } from "@/lib/utils";

const EARNABLE_STATUSES = new Set(["accepted", "in_progress", "completed"]);

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseBookingDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function isOnOrAfter(bookingDate: string, boundary: Date) {
  return parseBookingDate(bookingDate) >= boundary;
}

export function buildCleanerEarningsSummary(jobs: CleanerDashboardJob[]): CleanerEarningsSummary {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  let todayCents = 0;
  let weekCents = 0;
  let monthCents = 0;
  let pendingCents = 0;
  let completedCount = 0;

  for (const job of jobs) {
    const status = job.offer.status;
    const earning = job.offer.earning_cents ?? 0;
    if (!EARNABLE_STATUSES.has(status) || earning <= 0) continue;

    const bookingDate = job.booking.booking_date;

    if (bookingDate === todayKey) {
      todayCents += earning;
    }
    if (isOnOrAfter(bookingDate, weekStart)) {
      weekCents += earning;
    }
    if (isOnOrAfter(bookingDate, monthStart)) {
      monthCents += earning;
    }
    if (status === "accepted" || status === "in_progress") {
      pendingCents += earning;
    }
    if (status === "completed") {
      completedCount += 1;
    }
  }

  const recentPayouts: CleanerEarningsEntry[] = jobs
    .filter((job) => job.offer.status === "completed" && (job.offer.earning_cents ?? 0) > 0)
    .slice(0, 8)
    .map((job) => ({
      id: job.offer.id,
      label: slugToTitle(job.booking.service_slug),
      date: job.booking.booking_date,
      amountCents: job.offer.earning_cents ?? 0,
      status: lifecycleModeFromOfferStatus(job.offer.status) ?? "completed",
    }));

  return {
    todayCents,
    weekCents,
    monthCents,
    pendingCents,
    completedCount,
    recentPayouts,
  };
}
