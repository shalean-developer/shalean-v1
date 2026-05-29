// Notification outbox worker endpoint.
//
// Invoked by the existing pg_cron job `process-notification-outbox-every-3min`
// (see supabase/migrations/20260519171748_launch_critical_pg_cron_jobs.sql),
// which POSTs with `Authorization: Bearer <cron_secret>` from Supabase Vault.
// Set the CRON_SECRET env var to the same value. Can also be triggered manually.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processNotificationOutbox } from "@/lib/notifications/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return token.length > 0 && token === secret;
}

async function handle(request: Request, triggerSource: "cron" | "manual") {
  if (!process.env.CRON_SECRET?.trim()) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Supabase is not configured." },
      { status: 503 },
    );
  }

  const summary = await processNotificationOutbox(supabase, { triggerSource });

  return Response.json({
    ok: summary.ok,
    reclaimed: summary.reclaimed,
    scanned: summary.scanned,
    sent: summary.sent,
    dryRun: summary.dryRun,
    failed: summary.failed,
    errorCount: summary.errorCount,
  });
}

export async function POST(request: Request) {
  return handle(request, "cron");
}

// Allow manual invocation (e.g. from an admin tool) using the same bearer secret.
export async function GET(request: Request) {
  return handle(request, "manual");
}
