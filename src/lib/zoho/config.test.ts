import { describe, expect, it } from "vitest";
import {
  normalizeZohoDc,
  zohoAccountsBaseUrl,
  zohoApiBaseUrl,
  zohoInvoiceAppUrl,
} from "./config";

describe("normalizeZohoDc", () => {
  it("defaults to com when empty or nullish", () => {
    expect(normalizeZohoDc("")).toBe("com");
    expect(normalizeZohoDc(null)).toBe("com");
    expect(normalizeZohoDc(undefined)).toBe("com");
  });

  it("maps friendly aliases and region codes", () => {
    expect(normalizeZohoDc("us")).toBe("com");
    expect(normalizeZohoDc("EU")).toBe("eu");
    expect(normalizeZohoDc("india")).toBe("in");
    expect(normalizeZohoDc("australia")).toBe("com.au");
    expect(normalizeZohoDc("au")).toBe("com.au");
  });

  it("strips a leading dot and lowercases raw suffixes", () => {
    expect(normalizeZohoDc(".COM.AU")).toBe("com.au");
    expect(normalizeZohoDc("jp")).toBe("jp");
  });
});

describe("zoho base URLs", () => {
  it("builds accounts and api base URLs for the data center", () => {
    expect(zohoAccountsBaseUrl("eu")).toBe("https://accounts.zoho.eu");
    expect(zohoApiBaseUrl("eu")).toBe("https://www.zohoapis.eu/books/v3");
    expect(zohoApiBaseUrl("au")).toBe("https://www.zohoapis.com.au/books/v3");
  });

  it("builds an invoice deep link", () => {
    expect(
      zohoInvoiceAppUrl({ dc: "com", organizationId: "12345", invoiceId: "inv-1" }),
    ).toBe("https://books.zoho.com/app/12345#/invoices/inv-1");
  });
});
