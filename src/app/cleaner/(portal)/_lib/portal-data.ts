import { cache } from "react";
import { requireCleanerSession } from "@/lib/auth/server";
import { getCleanerAvailability, getCleanerReadiness } from "@/lib/cleaner/portal";
import { loadCleanerDashboard } from "@/lib/dashboard/data";

export const getCleanerPortalData = cache(async () => {
  const cleanerSession = await requireCleanerSession();
  const dashboard = await loadCleanerDashboard({ cleanerId: cleanerSession.cleaner.id });
  const cleaner = dashboard.selectedCleaner ?? cleanerSession.cleaner;
  const hasInProgressJob = dashboard.inProgressJobs.length > 0;
  const availability = getCleanerAvailability(cleaner, { hasInProgressJob });
  const readiness = getCleanerReadiness(cleaner, { hasInProgressJob });
  const earningJobs = [...dashboard.upcomingJobs, ...dashboard.inProgressJobs, ...dashboard.completedJobs];
  const today = new Date();

  const todayEarnings = sumEarnings(
    earningJobs.filter((job) => isSameDay(today, new Date(`${job.booking.booking_date}T00:00:00`))),
  );
  const weeklyEarnings = sumEarnings(
    earningJobs.filter((job) => daysAgo(today, new Date(`${job.booking.booking_date}T00:00:00`)) <= 7),
  );
  const monthlyEarnings = sumEarnings(
    earningJobs.filter((job) => isSameMonth(today, new Date(`${job.booking.booking_date}T00:00:00`))),
  );
  const pendingPayoutCents = sumEarnings(dashboard.completedJobs);

  return {
    cleanerSession,
    dashboard: {
      ...dashboard,
      selectedCleaner: cleaner,
    },
    availability,
    readiness,
    earnings: {
      todayEarnings,
      weeklyEarnings,
      monthlyEarnings,
      pendingPayoutCents,
      history: dashboard.completedJobs,
    },
  };
});

function sumEarnings(items: Array<{ offer: { earning_cents: number | null } }>) {
  return items.reduce((total, item) => total + (item.offer.earning_cents ?? 0), 0);
}

function daysAgo(today: Date, date: Date) {
  const diffMs = today.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isSameDay(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function isSameMonth(left: Date, right: Date) {
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth();
}
