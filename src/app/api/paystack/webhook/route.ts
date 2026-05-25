import { verifyPaystackSignature } from "@/lib/payments/paystack";

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

  return Response.json({
    received: true,
    event: event.event,
    bookingId: event.data?.metadata?.bookingId,
    idempotencyKey: event.data?.reference,
  });
}
