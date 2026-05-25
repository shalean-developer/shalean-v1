import { calculateQuote } from "@/lib/booking/pricing";
import { bookingDraftSchema } from "@/lib/booking/schema";
import { initializePaystackTransaction } from "@/lib/payments/paystack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bookingDraftSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      { error: "Complete the required booking details before checkout.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const quote = calculateQuote(parsed.data);
  const bookingId = crypto.randomUUID();
  const origin = new URL(request.url).origin;

  try {
    const transaction = await initializePaystackTransaction({
      email: parsed.data.customer.email,
      amountCents: quote.totalCents,
      bookingId,
      callbackUrl: `${origin}/dashboard?payment=paystack&booking=${bookingId}`,
    });

    return Response.json({
      bookingId,
      quote,
      reference: transaction.data.reference,
      authorizationUrl: transaction.data.authorization_url,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to initialize Paystack checkout.",
      },
      { status: 502 },
    );
  }
}
