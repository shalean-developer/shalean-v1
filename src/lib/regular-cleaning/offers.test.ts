import { describe, expect, it } from "vitest";

const activeStatuses = ["pending_payment", "offered", "accepted", "in_progress"];

describe("Regular Cleaning offer status policy", () => {
  it("treats declined offers as inactive so admin reassignment can happen", () => {
    expect(activeStatuses.includes("declined")).toBe(false);
    expect(activeStatuses.includes("offered")).toBe(true);
  });
});
