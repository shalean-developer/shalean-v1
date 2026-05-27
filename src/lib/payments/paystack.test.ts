import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyPaystackSignature } from "./paystack";

const originalSecret = process.env.PAYSTACK_SECRET_KEY;

afterEach(() => {
  process.env.PAYSTACK_SECRET_KEY = originalSecret;
});

describe("verifyPaystackSignature", () => {
  it("accepts valid Paystack signatures", () => {
    process.env.PAYSTACK_SECRET_KEY = "test_secret";
    const body = JSON.stringify({ event: "charge.success" });
    const signature = crypto.createHmac("sha512", "test_secret").update(body).digest("hex");

    expect(verifyPaystackSignature(body, signature)).toBe(true);
  });

  it("rejects malformed signatures without throwing", () => {
    process.env.PAYSTACK_SECRET_KEY = "test_secret";

    expect(() => verifyPaystackSignature("{}", "bad")).not.toThrow();
    expect(verifyPaystackSignature("{}", "bad")).toBe(false);
  });
});
