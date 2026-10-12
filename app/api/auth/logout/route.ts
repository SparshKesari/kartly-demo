import { cookies } from "next/headers";
import { handler, ok } from "@/lib/api";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/auth";
import { mutate } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await mutate((db) => {
      db.sessions = db.sessions.filter((s) => s.token !== token);
    });
  }
  clearSessionCookie();
  return ok({ loggedOut: true });
});
