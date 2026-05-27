"use client";

import { useEffect } from "react";

const storageKey = "shalean.booking.v1";

export function ClearBookingDraft({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event("shalean-booking-storage"));
  }, [enabled]);

  return null;
}
