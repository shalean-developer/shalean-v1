import { z } from "zod";
import { ensureCustomerProfile, getCurrentUser, getProfileForUser } from "@/lib/auth/server";

const customerProfileSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  phone: z.string().min(6),
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Customer login is required." }, { status: 401 });
  }

  let profile: Awaited<ReturnType<typeof getProfileForUser>> = null;
  try {
    profile = await getProfileForUser(user.id);
  } catch {
    profile = null;
  }

  const metadataFullName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const metadataPhone =
    typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : "";

  return Response.json({
    profile: {
      fullName: profile?.full_name ?? metadataFullName,
      email: user.email ?? "",
      phone: profile?.phone ?? metadataPhone,
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Customer login is required." }, { status: 401 });
  }

  const json = await request.json();
  const parsed = customerProfileSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Complete your customer profile.", issues: parsed.error.issues }, { status: 422 });
  }

  const customerId = await ensureCustomerProfile({
    userId: user.id,
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
  });

  return Response.json({ customerId });
}
