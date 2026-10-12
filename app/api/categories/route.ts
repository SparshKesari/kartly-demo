import { handler, ok } from "@/lib/api";
import { read } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const db = read();
  return ok(
    db.categories.map((c) => ({ ...c, productCount: db.products.filter((p) => p.categoryId === c.id).length })),
  );
});
