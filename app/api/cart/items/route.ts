import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { addItem, buildCartView, getOrCreateCart } from "@/lib/cart";
import { mutate } from "@/lib/db";
import { ensureOwner } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  productId: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(100).default(1),
  variant: z.record(z.string().max(40), z.string().max(40)).optional(),
});

export const POST = handler(async (req: Request) => {
  const input = await parseBody(req, schema);
  const owner = ensureOwner();
  const result = await mutate((db) => {
    const cart = getOrCreateCart(db, owner);
    const added = addItem(db, cart, input.productId, input.quantity, input.variant);
    return { ...added, cart: buildCartView(db, cart) };
  });
  return ok(result, 201);
});
