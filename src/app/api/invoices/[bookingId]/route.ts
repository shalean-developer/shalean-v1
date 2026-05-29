// Streams a booking's Zoho invoice PDF to the owning customer or an admin.
// The PDF is fetched server-side with Zoho credentials (never exposed to the
// browser); access is authorized per-request.

import { getAdminSession, getCurrentUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getZohoInvoicePdfForBooking } from "@/lib/zoho/books";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  if (!bookingId) {
    return Response.json({ error: "Missing booking id." }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return Response.json({ error: "Service unavailable." }, { status: 503 });
  }

  const bookingResult = await supabase
    .from("bookings")
    .select("id, customer_id, zoho_invoice_id, zoho_invoice_number")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingResult.error || !bookingResult.data) {
    return Response.json({ error: "Booking not found." }, { status: 404 });
  }
  const booking = bookingResult.data;

  const authorized = await isAuthorizedForBooking(supabase, booking.customer_id);
  if (!authorized) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!booking.zoho_invoice_id) {
    return Response.json({ error: "No invoice is available for this booking yet." }, { status: 404 });
  }

  const result = await getZohoInvoicePdfForBooking(booking.zoho_invoice_id);
  if (!result) {
    return Response.json({ error: "The invoice could not be retrieved right now." }, { status: 502 });
  }

  const filename = `Invoice-${booking.zoho_invoice_number ?? booking.zoho_invoice_id}.pdf`.replace(
    /[^A-Za-z0-9._-]/g,
    "_",
  );

  return new Response(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function isAuthorizedForBooking(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerId: string | null,
): Promise<boolean> {
  const adminSession = await getAdminSession();
  if (adminSession) {
    return true;
  }

  if (!customerId) {
    return false;
  }

  const user = await getCurrentUser();
  if (!user) {
    return false;
  }

  const customerResult = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return Boolean(customerResult.data) && !customerResult.error;
}
