import { handler, ok } from "@/lib/api";
import { mutate } from "@/lib/db";
import { cancelOrder } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = requireUser();
  const order = await mutate((db) => cancelOrder(db, user.id, params.id));
  return ok(order);
});
