import { NextResponse } from "next/server";
import { clearCleanerSession } from "@/lib/auth/server";

export async function POST(request: Request) {
  await clearCleanerSession();
  return NextResponse.redirect(new URL("/cleaner/login", request.url));
}
