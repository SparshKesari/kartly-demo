import { handler, ok } from "@/lib/api";
import { buildCartView, findCart } from "@/lib/cart";
import { mutate } from "@/lib/db";
import { buyAgain } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = requireUser();
  const result = await mutate((db) => {
    const r = buyAgain(db, user.id, params.id);
    return { ...r, cart: buildCartView(db, findCart(db, { userId: user.id })) };
  });
  return ok(result);
});
