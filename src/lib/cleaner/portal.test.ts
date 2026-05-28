import { describe, expect, it } from "vitest";
import { getCleanerAvailability } from "./portal";

describe("getCleanerAvailability", () => {
  it("returns offline when cleaner account is inactive", () => {
    const availability = getCleanerAvailability({ active: false, available: true });
    expect(availability.state).toBe("offline");
    expect(availability.label).toBe("Offline");
  });

  it("returns offline when cleaner is set offline", () => {
    const availability = getCleanerAvailability({ active: true, available: false });
    expect(availability.state).toBe("offline");
    expect(availability.label).toBe("Offline");
  });

  it("returns busy when cleaner has an active in-progress job", () => {
    const availability = getCleanerAvailability(
      { active: true, available: true },
      { hasInProgressJob: true },
    );
    expect(availability.state).toBe("busy");
    expect(availability.label).toBe("Busy");
  });

  it("returns online for active and available cleaners with no active job", () => {
    const availability = getCleanerAvailability(
      { active: true, available: true },
      { hasInProgressJob: false },
    );
    expect(availability.state).toBe("online");
    expect(availability.label).toBe("Online");
  });
});
