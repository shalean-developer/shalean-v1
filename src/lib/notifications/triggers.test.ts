import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { notifyInvoiceCreated } from "./triggers";

type EnqueuedRow = {
  channel: string;
  recipient: string;
  status: string;
  payload: {
    type: string;
    data: Record<string, unknown>;
  };
};

function makeCapturingSupabase() {
  const rows: EnqueuedRow[] = [];
  const client = {
    from() {
      return {
        insert(value: EnqueuedRow) {
          rows.push(value);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { rows, client: client as unknown as SupabaseClient<Database> };
}

const ZOHO_URL = "https://books.zoho.com/app/999#/invoices/inv-1";

describe("notifyInvoiceCreated", () => {
  it("links the customer to the Shalean dashboard, not the Zoho app URL", async () => {
    const { rows, client } = makeCapturingSupabase();

    await notifyInvoiceCreated(client, {
      bookingId: "abc-123",
      customerEmail: "customer@example.com",
      customerName: "Sipho Dlamini",
      invoiceNumber: "INV-1",
      serviceName: "Deep Clean",
      amountCents: 120000,
      invoiceUrl: ZOHO_URL,
      notifyCustomer: true,
    });

    const customerRow = rows.find((row) => row.payload.type === "invoice_created");
    expect(customerRow).toBeDefined();
    expect(customerRow?.recipient).toBe("customer@example.com");
    expect(customerRow?.payload.data.invoiceUrl).toContain("/dashboard?booking=abc-123");
    expect(customerRow?.payload.data.invoiceUrl).not.toContain("books.zoho");
  });

  it("keeps the Zoho app URL on the admin copy", async () => {
    const { rows, client } = makeCapturingSupabase();

    await notifyInvoiceCreated(client, {
      bookingId: "abc-123",
      customerEmail: "customer@example.com",
      customerName: "Sipho Dlamini",
      invoiceNumber: "INV-1",
      serviceName: "Deep Clean",
      amountCents: 120000,
      invoiceUrl: ZOHO_URL,
      notifyCustomer: true,
    });

    const adminRow = rows.find((row) => row.payload.type === "admin_invoice_created");
    expect(adminRow).toBeDefined();
    expect(adminRow?.payload.data.invoiceUrl).toBe(ZOHO_URL);
  });
});
