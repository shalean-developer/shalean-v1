import type { Database } from "@/lib/supabase/database.types";

type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];

export type CleanerAvailabilityState = "online" | "offline" | "busy";

export function getCleanerName(cleaner: { display_name: string | null; full_name: string | null }) {
  return cleaner.display_name ?? cleaner.full_name ?? "Shalean cleaner";
}

export function getCleanerAvailability(
  cleaner: { available: boolean; active: boolean },
  options?: { hasInProgressJob?: boolean },
) {
  if (!cleaner.active) {
    return {
      state: "offline" as CleanerAvailabilityState,
      label: "Offline",
      description: "Your cleaner account is inactive and cannot receive offers.",
      badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }

  if (!cleaner.available) {
    return {
      state: "offline" as CleanerAvailabilityState,
      label: "Offline",
      description: "You are not receiving new job offers.",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (options?.hasInProgressJob) {
    return {
      state: "busy" as CleanerAvailabilityState,
      label: "Busy",
      description: "You are currently on an active job.",
      badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-900",
    };
  }

  return {
    state: "online" as CleanerAvailabilityState,
    label: "Online",
    description: "You can receive new offers.",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}

export function getCleanerReadiness(cleaner: CleanerRow, options?: { hasInProgressJob?: boolean }) {
  const availability = getCleanerAvailability(cleaner, options);
  const payoutReady = cleaner.auth_user_id && cleaner.auth_email && cleaner.phone;

  return [
    { label: "Availability status", value: availability.label },
    { label: "Equipment eligible", value: cleaner.equipment_eligible ? "Yes" : "No" },
    { label: "Service areas", value: `${cleaner.suburbs.length} area${cleaner.suburbs.length === 1 ? "" : "s"}` },
    { label: "Rating", value: cleaner.rating > 0 ? `${cleaner.rating.toFixed(1)} / 5` : "New cleaner" },
    { label: "Tenure", value: formatTenure(cleaner.tenure_months) },
    { label: "Payout verification", value: payoutReady ? "Verified" : "Action needed" },
  ];
}

export function formatTenure(months: number) {
  if (months <= 0) {
    return "New this month";
  }

  if (months < 12) {
    return `${months} month${months === 1 ? "" : "s"}`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) {
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  return `${years}y ${remainingMonths}m`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatTimeWindow(timeWindow: string) {
  return timeWindow.replace("-", " - ");
}

export function formatHours(minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return "To be confirmed";
  }

  return `${Number((minutes / 60).toFixed(1))}h`;
}

export function formatAddons(addons: Array<{ label: string }>) {
  return addons.length > 0 ? addons.map((addon) => addon.label).join(", ") : "None";
}

export function buildMapsUrl(address: string, suburb: string) {
  const query = encodeURIComponent(`${address}, ${suburb}, Cape Town, South Africa`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function statusLabel(mode: "offer" | "accepted" | "in_progress" | "completed") {
  const labels = {
    offer: "New offer",
    accepted: "Accepted",
    in_progress: "In progress",
    completed: "Completed",
  };

  return labels[mode];
}

export function statusBadgeClass(mode: "offer" | "accepted" | "in_progress" | "completed") {
  const classes = {
    offer: "border-sky-200 bg-sky-50 text-sky-800",
    accepted: "border-amber-200 bg-amber-50 text-amber-900",
    in_progress: "border-indigo-200 bg-indigo-50 text-indigo-800",
    completed: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return classes[mode];
}

export const fallbackCleanerPhoto = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80";
