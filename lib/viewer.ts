import { getCurrentUser } from "./auth";
import { read } from "./db";
import type { DB } from "./types";

/** Product ids on the signed-in user's wishlist (empty for guests). */
export function viewerWishlist(db: DB = read()): Set<string> {
  const user = getCurrentUser();
  if (!user) return new Set();
  return new Set(db.wishlists.find((w) => w.userId === user.id)?.productIds ?? []);
}
