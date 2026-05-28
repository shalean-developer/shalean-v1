import { quoteRequestSchema } from "@/lib/booking/schema";
import { bookingDraftToRegularCleaningInput } from "@/lib/regular-cleaning/adapter";
import { buildRegularCleaningQuote, loadRegularCleaningCatalog } from "@/lib/regular-cleaning/repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = quoteRequestSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Invalid quote request", issues: parsed.error.issues }, { status: 422 });
  }

  if (parsed.data.serviceSlug !== "regular-cleaning") {
    return Response.json(
      { error: "This service is not available for online quoting yet." },
      { status: 422 },
    );
  }

  try {
    const quoteDraft = {
      ...parsed.data,
      date: parsed.data.date || new Date().toISOString().slice(0, 10),
    };
    const regularInput = bookingDraftToRegularCleaningInput(quoteDraft);
    const catalog = await loadRegularCleaningCatalog(createSupabaseAdminClient(), regularInput.suburb);

    return Response.json(buildRegularCleaningQuote(regularInput, catalog));
  } catch (error) {
    console.error("BOOKING_QUOTE_FAILED", {
      serviceSlug: parsed.data.serviceSlug,
      message: error instanceof Error ? error.message : "Unknown quote error",
    });

    return Response.json(
      { error: "Pricing is temporarily unavailable. Please try again shortly or contact Shalean support." },
      { status: 503 },
    );
  }
}

export async function GET() {
  return Response.json({
    message: "POST a booking draft to receive a Shalean quote.",
  });
}
