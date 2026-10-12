import { z } from "zod";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { buildCartView, findCart, removeItem, updateItem } from "@/lib/cart";
import { mutate } from "@/lib/db";
import { currentOwner } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    quantity: z.number().int().min(1).max(100).optional(),
    savedForLater: z.boolean().optional(),
  })
  .refine((v) => v.quantity !== undefined || v.savedForLater !== undefined, { message: "Nothing to update." });

type Ctx = { params: { lineId: string } };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const input = await parseBody(req, patchSchema);
  const owner = currentOwner();
  const cart = await mutate((db) => {
    const c = findCart(db, owner);
    if (!c) throw new ApiError(404, "not_found", "Cart item not found.");
    updateItem(db, c, params.lineId, input);
    return buildCartView(db, c);
  });
  return ok({ cart });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const owner = currentOwner();
  const cart = await mutate((db) => {
    const c = findCart(db, owner);
    if (!c) throw new ApiError(404, "not_found", "Cart item not found.");
    removeItem(c, params.lineId);
    return buildCartView(db, c);
  });
  return ok({ cart });
});
