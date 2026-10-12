import { handler, ok } from "@/lib/api";
import { buildCartView, findCart } from "@/lib/cart";
import { read } from "@/lib/db";
import { currentOwner } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const db = read();
  return ok(buildCartView(db, findCart(db, currentOwner())));
});
