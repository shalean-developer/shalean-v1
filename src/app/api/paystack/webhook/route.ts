import { verifyPaystackSignature } from "@/lib/payments/paystack";
import { reconcilePaystackPayment } from "@/lib/payments/reconciliation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(rawBody, signature)) {
    return Response.json({ error: "Invalid Paystack signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    data?: {
      reference?: string;
      metadata?: {
        bookingId?: string;
      };
    };
  };

  if (event.event !== "charge.success") {
    return Response.json({
      received: true,
      event: event.event,
      reconciled: false,
    });
  }

  const reference = event.data?.reference;

  if (!reference) {
    return Response.json({ error: "Missing Paystack reference" }, { status: 422 });
  }

  const result = await reconcilePaystackPayment({
    bookingId: event.data?.metadata?.bookingId,
    reference,
    source: "webhook",
  });

  return Response.json({
    received: true,
    event: event.event,
    bookingId: result.bookingId,
    paymentId: result.paymentId,
    idempotencyKey: result.reference,
    reconciled: result.reconciled,
  });
}
