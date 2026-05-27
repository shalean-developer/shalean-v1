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
  const expected = Buffer.from(hash, "hex");
  const received = Buffer.from(signature, "hex");

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

export async function initializePaystackTransaction(payload: PaystackInitializePayload) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  if (!payload.email || !payload.email.includes("@")) {
    throw new Error("A valid customer email is required for Paystack checkout.");
  }

  if (!Number.isFinite(payload.amountCents) || payload.amountCents <= 0) {
    throw new Error("A valid positive checkout amount is required for Paystack.");
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
    const message = await response.text();
    throw new Error(`Paystack initialization failed with ${response.status}: ${message.slice(0, 240)}`);
  }

  const payloadJson = await response.json() as {
    status: boolean;
    message?: string;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  };

  if (!payloadJson.status || !payloadJson.data?.authorization_url) {
    throw new Error(payloadJson.message ?? "Paystack did not return an authorization URL.");
  }

  return payloadJson;
}

export async function verifyPaystackTransaction(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Paystack verification failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    status: boolean;
    message: string;
    data?: {
      amount?: number;
      currency?: string;
      reference?: string;
      status?: string;
      paid_at?: string | null;
      metadata?: {
        bookingId?: string;
      };
    };
  };

  return {
    ok: payload.status,
    message: payload.message,
    amountCents: Math.max(0, Math.round(payload.data?.amount ?? 0)),
    currency: payload.data?.currency ?? "ZAR",
    reference: payload.data?.reference ?? reference,
    providerStatus: payload.data?.status ?? "unknown",
    paidAt: payload.data?.paid_at ?? null,
    bookingId: payload.data?.metadata?.bookingId,
    raw: payload,
  };
}
