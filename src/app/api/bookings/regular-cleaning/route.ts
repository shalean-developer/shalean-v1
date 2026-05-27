export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      error: "Regular Cleaning bookings must be created through authenticated checkout.",
      code: "CHECKOUT_REQUIRED",
    },
    { status: 410 },
  );
}
