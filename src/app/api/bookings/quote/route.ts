import { calculateQuote } from "@/lib/booking/pricing";
import { quoteRequestSchema } from "@/lib/booking/schema";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = quoteRequestSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Invalid quote request", issues: parsed.error.issues }, { status: 422 });
  }

  return Response.json({ quote: calculateQuote(parsed.data) });
}

export async function GET() {
  return Response.json({
    message: "POST a booking draft to receive a Shalean quote.",
  });
}
