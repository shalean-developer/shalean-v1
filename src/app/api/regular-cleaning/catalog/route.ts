import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadRegularCleaningCatalog } from "@/lib/regular-cleaning/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const suburb = new URL(request.url).searchParams.get("suburb") ?? undefined;
  const supabase = createSupabaseAdminClient();
  const catalog = await loadRegularCleaningCatalog(supabase, suburb);

  return Response.json({
    catalog: {
      ...catalog,
      cleaners: catalog.cleaners.map((cleaner) => ({
        id: cleaner.id,
        display_name: cleaner.display_name,
        full_name: cleaner.full_name,
        photo_url: cleaner.photo_url,
        rating: cleaner.rating,
        experience_years: cleaner.experience_years,
        available: cleaner.available,
        active: cleaner.active,
        equipment_eligible: cleaner.equipment_eligible,
        service_slugs: cleaner.service_slugs,
        suburbs: cleaner.suburbs,
        tenure_months: cleaner.tenure_months,
      })),
    },
  });
}
