import crypto from "node:crypto";

export type PaystackInitializePayload = {
  email: string;
  amountCents: number;
  bookingId: string;
  callbackUrl: string;
};

export function toPaystackAmount(cents: number) {
  return Math.max(0, Math.round(cents));
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret || !signature) {
    return false;
  }

  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

export async function initializePaystackTransaction(payload: PaystackInitializePayload) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      amount: toPaystackAmount(payload.amountCents),
      callback_url: payload.callbackUrl,
      metadata: {
        bookingId: payload.bookingId,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Paystack initialization failed with ${response.status}`);
  }

  return response.json() as Promise<{
    status: boolean;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }>;
}
