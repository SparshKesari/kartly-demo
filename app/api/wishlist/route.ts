import { handler, ok } from "@/lib/api";
import { categoryMap, toSummary } from "@/lib/catalog";
import { read } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = requireUser();
  const db = read();
  const ids = db.wishlists.find((w) => w.userId === user.id)?.productIds ?? [];
  const categories = categoryMap(db);
  const items = ids
    .map((id) => db.products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => toSummary(p, categories));
  return ok({ productIds: ids, items });
});
