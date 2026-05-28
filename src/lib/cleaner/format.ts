import type { CleanerJobLifecycleMode } from "@/lib/cleaner/types";

export const CLEANER_FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80";

export function getCleanerName(cleaner: { display_name: string | null; full_name: string | null }) {
  return cleaner.display_name ?? cleaner.full_name ?? "Shalean cleaner";
}

export function formatAddons(addons: Array<{ label: string }>) {
  return addons.length > 0 ? addons.map((addon) => addon.label).join(", ") : "None";
}

export function formatBookingDate(date: string) {
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

export function formatEstimatedHours(minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return "To be confirmed";
  }
  return `${Number((minutes / 60).toFixed(1))}h`;
}

export function buildMapsUrl(address: string, suburb: string) {
  const query = encodeURIComponent(`${address}, ${suburb}, Cape Town, South Africa`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function lifecycleStatusLabel(mode: CleanerJobLifecycleMode) {
  const labels: Record<CleanerJobLifecycleMode, string> = {
    offer: "New offer",
    accepted: "Accepted",
    in_progress: "In progress",
    completed: "Completed",
  };
  return labels[mode];
}

export function lifecycleStatusBadgeClass(mode: CleanerJobLifecycleMode) {
  const classes: Record<CleanerJobLifecycleMode, string> = {
    offer: "border-sky-200 bg-sky-50 text-sky-800",
    accepted: "border-amber-200 bg-amber-50 text-amber-900",
    in_progress: "border-indigo-200 bg-indigo-50 text-indigo-800",
    completed: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return classes[mode];
}

export const LIFECYCLE_STEPS: Array<{ mode: CleanerJobLifecycleMode; label: string }> = [
  { mode: "offer", label: "Offer" },
  { mode: "accepted", label: "Accepted" },
  { mode: "in_progress", label: "In progress" },
  { mode: "completed", label: "Completed" },
];
