import { handler, ok } from "@/lib/api";
import { publicUser } from "@/lib/auth";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = requireUser();
  return ok({ user: publicUser(user) });
});
