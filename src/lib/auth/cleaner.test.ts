import { describe, expect, it } from "vitest";
import {
  canonicalizeCleanerPhoneDigits,
  cleanCleanerPhone,
  cleanerEmailFromPhone,
  cleanerLoginEmailsFromPhone,
  validateCleanerPhone,
} from "./cleaner";

describe("cleaner auth phone helpers", () => {
  it("generates cleaner emails from local and international phone numbers", () => {
    expect(cleanerEmailFromPhone("0792022648")).toBe("0792022648@shalean.co.za");
    expect(cleanerEmailFromPhone("+27 79 202 2648")).toBe("0792022648@shalean.co.za");
  });

  it("canonicalizes international digits to local 0-prefixed form", () => {
    expect(canonicalizeCleanerPhoneDigits("27792022648")).toBe("0792022648");
    expect(validateCleanerPhone("0027 79 202 2648")).toBe("0792022648");
  });

  it("removes spaces and symbols before validation", () => {
    expect(cleanCleanerPhone("(079) 202-2648")).toBe("0792022648");
  });

  it("offers legacy international login email as fallback", () => {
    expect(cleanerLoginEmailsFromPhone("0792022648")).toEqual([
      "0792022648@shalean.co.za",
      "27792022648@shalean.co.za",
    ]);
  });

  it("rejects invalid cleaner phone numbers", () => {
    expect(() => validateCleanerPhone("")).toThrow("Phone number is required.");
    expect(() => validateCleanerPhone("12345")).toThrow("Enter a valid South African phone number.");
  });
});
