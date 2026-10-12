"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, loginUrl } from "@/lib/client";
import type { CartView } from "@/lib/cart";
import { formatMoney } from "@/lib/pricing";
import type { Variant } from "@/lib/types";
import { HeartIcon } from "./HeartIcon";
import { useApp } from "./Providers";
import { useWishlistToggle } from "./useWishlist";

type Props = {
  product: {
    id: string;
    slug: string;
    title: string;
    images: string[];
    price: number;
    stock: number;
    maxPerOrder: number;
    variants?: Variant[];
  };
  wishlisted: boolean;
};

export function ProductGallery({ title, images }: { title: string; images: string[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      <ul className="flex gap-2 overflow-x-auto md:flex-col" aria-label="Product images">
        {images.map((src, i) => (
          <li key={src} className="shrink-0">
            <button
              type="button"
              data-testid={`pdp-thumb-${i}`}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded border-2 bg-white md:h-16 md:w-16 ${
                i === active ? "border-amber-500" : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <img src={src} alt={`${title} thumbnail ${i + 1}`} className="h-full w-full object-contain" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-1 items-center justify-center rounded-lg bg-white p-2">
        <img
          data-testid="pdp-image-main"
          src={images[active]}
          alt={title}
          className="aspect-square w-full max-w-[520px] object-contain"
        />
      </div>
    </div>
  );
}

export function BuyBox({ product, wishlisted }: Props) {
  const router = useRouter();
  const { user, setCartCount, toast } = useApp();
  const wishlist = useWishlistToggle(product.id, wishlisted);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"cart" | "buy" | null>(null);
  const outOfStock = product.stock <= 0;
  const maxQty = Math.max(0, Math.min(product.stock, product.maxPerOrder));
  const variants = product.variants ?? [];
  const missing = variants.filter((v) => !selected[v.name]).map((v) => v.name);
  const canAdd = !outOfStock && missing.length === 0;

  async function add(mode: "cart" | "buy") {
    if (!canAdd || busy) return;
    setBusy(mode);
    const res = await api<{ message: string; cart: CartView }>("/api/cart/items", {
      body: { productId: product.id, quantity: qty, ...(variants.length ? { variant: selected } : {}) },
    });
    if (!res.ok) {
      setBusy(null);
      toast(res.error.message, "error");
      return;
    }
    setCartCount(res.data.cart.count);
    if (mode === "buy") {
      router.push(user ? "/checkout" : loginUrl("/checkout"));
      return;
    }
    setBusy(null);
    toast(res.data.message === "Added to cart" ? `Added ${qty} × "${product.title}" to your cart` : res.data.message);
  }

  return (
    <div className="space-y-4">
      {variants.map((v) => (
        <fieldset key={v.name}>
          <legend className="mb-1 text-sm">
            <span className="font-semibold">{v.name}:</span> {selected[v.name] ?? <span className="text-slate-500">Select</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {v.options.map((o) => {
              const isOn = selected[v.name] === o;
              return (
                <button
                  key={o}
                  type="button"
                  data-testid={`variant-${v.name.toLowerCase()}-${o.toLowerCase()}`}
                  aria-pressed={isOn}
                  onClick={() => setSelected((s) => ({ ...s, [v.name]: o }))}
                  className={`min-h-[40px] min-w-[48px] rounded-md border px-3 text-sm ${
                    isOn ? "border-amber-600 bg-amber-50 font-semibold ring-2 ring-amber-400" : "border-slate-300 bg-white hover:bg-slate-50"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div>
        <label htmlFor="qty-select" className="label">
          Quantity
        </label>
        <select
          id="qty-select"
          data-testid="qty-select"
          value={qty}
          disabled={outOfStock}
          onChange={(e) => setQty(Number(e.target.value))}
          className="input w-28"
        >
          {(maxQty > 0 ? Array.from({ length: maxQty }, (_, i) => i + 1) : [1]).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {missing.length > 0 && !outOfStock && (
        <p className="text-sm text-slate-600" role="note">
          Select {missing.join(" and ")} to add this item to your cart.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button type="button" data-testid="add-to-cart-btn" disabled={!canAdd || busy !== null} onClick={() => add("cart")} className="btn-primary w-full">
          {busy === "cart" ? "Adding…" : "Add to Cart"}
        </button>
        <button type="button" data-testid="buy-now-btn" disabled={!canAdd || busy !== null} onClick={() => add("buy")} className="btn-secondary w-full">
          {busy === "buy" ? "Please wait…" : "Buy Now"}
        </button>
        <button
          type="button"
          data-testid="wishlist-btn"
          aria-pressed={wishlist.active}
          onClick={wishlist.toggle}
          disabled={wishlist.busy}
          className="btn-outline w-full"
        >
          <HeartIcon filled={wishlist.active} size={18} />
          {wishlist.active ? "In your wishlist" : "Add to Wishlist"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {formatMoney(product.price)} each · Limit {product.maxPerOrder} per order
      </p>
    </div>
  );
}
