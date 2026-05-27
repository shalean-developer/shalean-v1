import { z } from "zod";
import { ensureCustomerProfile, getCurrentUser } from "@/lib/auth/server";

const customerProfileSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  phone: z.string().min(6),
});

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
