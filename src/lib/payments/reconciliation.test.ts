import { describe, expect, it } from "vitest";
import { resolvePaystackReconciliationDecision } from "./reconciliation";

describe("resolvePaystackReconciliationDecision", () => {
  it("marks a matching successful Paystack verification as paid", () => {
    expect(resolvePaystackReconciliationDecision({
      providerStatus: "success",
      verifiedAmountCents: 216500,
      bookingTotalCents: 216500,
      paymentAmountCents: 216500,
    })).toEqual({
      paymentStatus: "paid",
      bookingStatus: "confirmed",
      reconciled: true,
    });
  });

  it("is idempotent for already paid successful references", () => {
    expect(resolvePaystackReconciliationDecision({
      providerStatus: "success",
      verifiedAmountCents: 42000,
      bookingTotalCents: 42000,
      paymentAmountCents: 42000,
    }).reconciled).toBe(true);
  });

  it("rejects a Paystack amount mismatch", () => {
    expect(() => resolvePaystackReconciliationDecision({
      providerStatus: "success",
      verifiedAmountCents: 10000,
      bookingTotalCents: 216500,
      paymentAmountCents: 216500,
    })).toThrow("Paystack amount does not match");
  });

  it("rejects a stored payment amount mismatch", () => {
    expect(() => resolvePaystackReconciliationDecision({
      providerStatus: "success",
      verifiedAmountCents: 216500,
      bookingTotalCents: 216500,
      paymentAmountCents: 10000,
    })).toThrow("Stored payment amount does not match");
  });

  it("does not mark failed or pending provider statuses as paid", () => {
    expect(resolvePaystackReconciliationDecision({
      providerStatus: "failed",
      verifiedAmountCents: 216500,
      bookingTotalCents: 216500,
      paymentAmountCents: 216500,
    })).toEqual({
      paymentStatus: "failed",
      bookingStatus: null,
      reconciled: false,
    });

    expect(resolvePaystackReconciliationDecision({
      providerStatus: "abandoned",
      verifiedAmountCents: 216500,
      bookingTotalCents: 216500,
      paymentAmountCents: 216500,
    })).toEqual({
      paymentStatus: "failed",
      bookingStatus: null,
      reconciled: false,
    });
  });
});
