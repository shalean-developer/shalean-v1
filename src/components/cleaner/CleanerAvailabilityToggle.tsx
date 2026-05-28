"use client";

import { useState } from "react";
import { toggleAvailabilityAction } from "@/lib/cleaner/actions";
import { cn } from "@/lib/utils";

type CleanerAvailabilityToggleProps = {
  available: boolean;
  returnTo?: string;
};

export function CleanerAvailabilityToggle({ available, returnTo = "/cleaner" }: CleanerAvailabilityToggleProps) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={toggleAvailabilityAction}
      className="flex items-center justify-between gap-4"
      onSubmit={() => setPending(true)}
    >
      <input type="hidden" name="available" value={available ? "false" : "true"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div>
        <p className="text-sm font-bold text-slate-950">Availability</p>
        <p className="mt-0.5 text-xs text-slate-600">
          {available
            ? "You are visible for new Regular Cleaning offers."
            : "You are paused and will not receive new offers."}
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        role="switch"
        aria-checked={available}
        aria-label={available ? "Set unavailable" : "Set available"}
        className={cn(
          "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60",
          available ? "border-emerald-700 bg-emerald-700" : "border-slate-300 bg-slate-200",
        )}
      >
        <span
          className={cn(
            "inline-block h-6 w-6 transform rounded-full bg-white shadow transition",
            available ? "translate-x-6" : "translate-x-0.5",
          )}
        />
      </button>
    </form>
  );
}
