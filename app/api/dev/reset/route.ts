import { NextResponse } from "next/server";
import { handler, ok } from "@/lib/api";
import { resetDb } from "@/lib/db";
import { clearPayments } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resetAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.KARTLY_ALLOW_RESET === "1";
}

export const POST = handler(async () => {
  if (!resetAllowed()) {
    return NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });
  }
  await resetDb();
  clearPayments();
  return ok({ reset: true });
});
