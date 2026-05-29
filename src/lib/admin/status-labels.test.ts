import { describe, expect, it } from "vitest";
import { describeAdminStatus } from "./status-labels";

describe("describeAdminStatus", () => {
  it("describes payment_pending booking status", () => {
    const result = describeAdminStatus("booking", "payment_pending");
    expect(result.label).toBe("Payment Pending");
    expect(result.tooltip).toContain("payment");
  });

  it("describes synced zoho status", () => {
    const result = describeAdminStatus("zoho", "synced");
    expect(result.label).toBe("Synced");
  });
});
