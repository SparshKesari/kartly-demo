"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductSummary } from "@/lib/catalog";
import type { CartView } from "@/lib/cart";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/pricing";
import { useApp } from "./Providers";
import { Stars } from "./Stars";

export function WishlistClient({ initial }: { initial: ProductSummary[] }) {
  const { setCartCount, toast } = useApp();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(p: ProductSummary, silent = false) {
    const res = await api(`/api/wishlist/${p.id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      toast(res.error.message, "error");
      return false;
    }
    setItems((list) => list.filter((x) => x.id !== p.id));
    if (!silent) toast(`Removed "${p.title}" from your wishlist`, "info");
    return true;
  }

  async function moveToCart(p: ProductSummary) {
    setBusy(p.id);
    const res = await api<{ cart: CartView }>("/api/cart/items", { body: { productId: p.id, quantity: 1 } });
    if (!res.ok) {
      setBusy(null);
      toast(res.error.message, "error");
      return;
    }
    setCartCount(res.data.cart.count);
    await remove(p, true);
    setBusy(null);
    toast(`Moved "${p.title}" to your cart`);
  }

  if (items.length === 0) {
    return (
      <div data-testid="empty-wishlist" className="card p-8 text-center">
        <p className="text-lg font-semibold">Your wishlist is empty</p>
        <p className="mt-1 text-sm text-slate-600">Tap the heart on any product to save it here.</p>
        <Link href="/" className="btn-primary mt-4">
          Discover products
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((p) => (
        <li key={p.id} data-testid={`wishlist-item-${p.id}`} className={`card flex gap-3 p-3 ${busy === p.id ? "opacity-60" : ""}`}>
          <Link href={`/p/${p.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded bg-slate-50">
            <img src={p.image} alt={p.title} className="h-full w-full object-contain p-1" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/p/${p.slug}`} className="line-clamp-2 min-h-[40px] font-medium hover:text-orange-700">
              {p.title}
            </Link>
            <div className="flex items-center gap-1 text-xs">
              <Stars rating={p.rating} size={14} />
              <span className="text-brand-link">{p.ratingCount}</span>
            </div>
            <p className="font-semibold">{formatMoney(p.price)}</p>
            <p className={`text-xs ${p.stock > 0 ? "text-emerald-700" : "text-red-700"}`}>{p.stock > 0 ? "In stock" : "Out of stock"}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {p.hasVariants ? (
                <Link href={`/p/${p.slug}`} data-testid={`wishlist-move-to-cart-${p.id}`} className="btn-primary px-3">
                  Choose options
                </Link>
              ) : (
                <button
                  type="button"
                  data-testid={`wishlist-move-to-cart-${p.id}`}
                  onClick={() => moveToCart(p)}
                  disabled={busy !== null || p.stock <= 0}
                  className="btn-primary px-3"
                >
                  Move to cart
                </button>
              )}
              <button type="button" data-testid={`wishlist-remove-${p.id}`} onClick={() => remove(p)} disabled={busy !== null} className="btn-outline px-3">
                Remove
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
