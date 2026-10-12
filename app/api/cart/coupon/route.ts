import { z } from "zod";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { applyCoupon, buildCartView, findCart, removeCoupon } from "@/lib/cart";
import { mutate } from "@/lib/db";
import { currentOwner } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().trim().min(1, "Enter a coupon code.").max(40) });

export const POST = handler(async (req: Request) => {
  const { code } = await parseBody(req, schema);
  const owner = currentOwner();
  const cart = await mutate((db) => {
    const c = findCart(db, owner);
    if (!c || c.items.every((l) => l.savedForLater)) throw new ApiError(422, "unprocessable", "Your cart is empty.");
    applyCoupon(db, c, code);
    return buildCartView(db, c);
  });
  return ok({ cart });
});

export const DELETE = handler(async () => {
  const owner = currentOwner();
  const cart = await mutate((db) => {
    const c = findCart(db, owner);
    if (!c) throw new ApiError(404, "not_found", "Cart not found.");
    removeCoupon(c);
    return buildCartView(db, c);
  });
  return ok({ cart });
});
