import { handler, ok } from "@/lib/api";
import { read } from "@/lib/db";
import { requireUserOrder } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = requireUser();
  return ok(requireUserOrder(read(), user.id, params.id));
});
