import { calculateQuote } from "@/lib/booking/pricing";
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

  if (parsed.data.serviceSlug === "regular-cleaning") {
    const quoteDraft = {
      ...parsed.data,
      date: parsed.data.date || new Date().toISOString().slice(0, 10),
    };
    const regularInput = bookingDraftToRegularCleaningInput(quoteDraft);
    const catalog = await loadRegularCleaningCatalog(createSupabaseAdminClient(), regularInput.suburb);
    return Response.json(buildRegularCleaningQuote(regularInput, catalog));
  }

  return Response.json({ quote: calculateQuote(parsed.data) });
}

export async function GET() {
  return Response.json({
    message: "POST a booking draft to receive a Shalean quote.",
  });
}
