import type { Metadata } from "next";
import { WishlistClient } from "@/components/WishlistClient";
import { categoryMap, toSummary } from "@/lib/catalog";
import { read } from "@/lib/db";
import { requirePageUser } from "@/lib/guards";

export const metadata: Metadata = { title: "Your Wishlist" };

export default function WishlistPage() {
  const user = requirePageUser("/account/wishlist");
  const db = read();
  const categories = categoryMap(db);
  const ids = db.wishlists.find((w) => w.userId === user.id)?.productIds ?? [];
  const items = ids
    .map((id) => db.products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => toSummary(p, categories));
  return (
    <div className="mx-auto max-w-4xl px-2 py-6 md:px-4">
      <h1 className="mb-4 text-2xl font-semibold">Your Wishlist</h1>
      <WishlistClient initial={items} />
    </div>
  );
}
