import { describe, expect, it } from "vitest";
import {
  cleanerStatusToFlags,
  countCleanerStatuses,
  deriveCleanerStatus,
} from "./cleaner-status";

describe("deriveCleanerStatus", () => {
  it("treats cleaners without a password as pending", () => {
    expect(
      deriveCleanerStatus({ active: true, available: true, password_set_at: null }),
    ).toBe("pending");
  });

  it("marks active cleaners with credentials as active", () => {
    expect(
      deriveCleanerStatus({ active: true, available: true, password_set_at: "2026-01-01" }),
    ).toBe("active");
  });

  it("marks deactivated but available cleaners as inactive", () => {
    expect(
      deriveCleanerStatus({ active: false, available: true, password_set_at: "2026-01-01" }),
    ).toBe("inactive");
  });

  it("marks deactivated and unavailable cleaners as suspended", () => {
    expect(
      deriveCleanerStatus({ active: false, available: false, password_set_at: "2026-01-01" }),
    ).toBe("suspended");
  });
});

describe("cleanerStatusToFlags", () => {
  it("maps statuses back to active/available flags", () => {
    expect(cleanerStatusToFlags("active")).toEqual({ active: true, available: true });
    expect(cleanerStatusToFlags("inactive")).toEqual({ active: false, available: true });
    expect(cleanerStatusToFlags("suspended")).toEqual({ active: false, available: false });
  });
});

describe("countCleanerStatuses", () => {
  it("counts cleaners across every status bucket", () => {
    const counts = countCleanerStatuses([
      { active: true, available: true, password_set_at: "2026-01-01" },
      { active: true, available: false, password_set_at: "2026-01-01" },
      { active: false, available: true, password_set_at: "2026-01-01" },
      { active: false, available: false, password_set_at: "2026-01-01" },
      { active: true, available: true, password_set_at: null },
    ]);

    expect(counts).toEqual({ active: 2, inactive: 1, suspended: 1, pending: 1 });
  });
});
