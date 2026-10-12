import { ApiError, handler, ok } from "@/lib/api";
import { mutate } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { productId: string } };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = requireUser();
  const productIds = await mutate((db) => {
    if (!db.products.some((p) => p.id === params.productId)) throw new ApiError(404, "not_found", "Product not found.");
    let list = db.wishlists.find((w) => w.userId === user.id);
    if (!list) {
      list = { userId: user.id, productIds: [] };
      db.wishlists.push(list);
    }
    if (!list.productIds.includes(params.productId)) list.productIds.push(params.productId);
    return list.productIds;
  });
  return ok({ productIds }, 201);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = requireUser();
  const productIds = await mutate((db) => {
    const list = db.wishlists.find((w) => w.userId === user.id);
    if (!list || !list.productIds.includes(params.productId)) throw new ApiError(404, "not_found", "This item is not in your wishlist.");
    list.productIds = list.productIds.filter((id) => id !== params.productId);
    return list.productIds;
  });
  return ok({ productIds });
});
