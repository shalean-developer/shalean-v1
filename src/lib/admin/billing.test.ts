import { describe, expect, it } from "vitest";
import {
  bookingAmountDueCents,
  computeManualPaymentUpdate,
  isAdminPaymentMethod,
  zohoPaymentModeFor,
} from "./billing";

describe("computeManualPaymentUpdate", () => {
  it("marks a full payment as paid and clears the balance", () => {
    expect(
      computeManualPaymentUpdate({ amountDueCents: 50000, alreadyPaidCents: 0, newPaymentCents: 50000 }),
    ).toEqual({
      payment_status: "paid",
      booking_status: "confirmed",
      amount_paid_cents: 50000,
      balance_remaining_cents: 0,
      fullyPaid: true,
    });
  });

  it("treats an over-payment as fully paid (balance never negative)", () => {
    const result = computeManualPaymentUpdate({ amountDueCents: 50000, alreadyPaidCents: 0, newPaymentCents: 60000 });
    expect(result.fullyPaid).toBe(true);
    expect(result.balance_remaining_cents).toBe(0);
    expect(result.amount_paid_cents).toBe(60000);
  });

  it("marks a partial payment as partially_paid with the remaining balance", () => {
    expect(
      computeManualPaymentUpdate({ amountDueCents: 50000, alreadyPaidCents: 0, newPaymentCents: 20000 }),
    ).toEqual({
      payment_status: "partially_paid",
      booking_status: undefined,
      amount_paid_cents: 20000,
      balance_remaining_cents: 30000,
      fullyPaid: false,
    });
  });

  it("accumulates prior partial payments to settle the booking", () => {
    const result = computeManualPaymentUpdate({ amountDueCents: 50000, alreadyPaidCents: 20000, newPaymentCents: 30000 });
    expect(result.payment_status).toBe("paid");
    expect(result.fullyPaid).toBe(true);
    expect(result.amount_paid_cents).toBe(50000);
    expect(result.balance_remaining_cents).toBe(0);
  });
});

describe("bookingAmountDueCents", () => {
  it("prefers amount_due_cents, then series total, then final total", () => {
    expect(bookingAmountDueCents({ amount_due_cents: 12345, series_total_cents: 999, final_total_cents: 1 })).toBe(12345);
    expect(bookingAmountDueCents({ amount_due_cents: null, series_total_cents: 88000, final_total_cents: 44000 })).toBe(88000);
    expect(bookingAmountDueCents({ amount_due_cents: null, series_total_cents: null, final_total_cents: 44000 })).toBe(44000);
  });
});

describe("payment method helpers", () => {
  it("recognizes the supported admin payment methods", () => {
    expect(isAdminPaymentMethod("eft")).toBe(true);
    expect(isAdminPaymentMethod("cash")).toBe(true);
    expect(isAdminPaymentMethod("paystack")).toBe(true);
    expect(isAdminPaymentMethod("bitcoin")).toBe(false);
  });

  it("maps each method to a Zoho payment mode", () => {
    expect(zohoPaymentModeFor("cash")).toBe("cash");
    expect(zohoPaymentModeFor("card")).toBe("creditcard");
    expect(zohoPaymentModeFor("eft")).toBe("banktransfer");
    expect(zohoPaymentModeFor("corporate")).toBe("banktransfer");
  });
});
