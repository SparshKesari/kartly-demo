"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductSummary } from "@/lib/catalog";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/pricing";
import type { CartView } from "@/lib/cart";
import { HeartIcon } from "./HeartIcon";
import { useApp } from "./Providers";
import { Stars } from "./Stars";
import { useWishlistToggle } from "./useWishlist";

export function ProductCard({ product, wishlisted, compact = false }: { product: ProductSummary; wishlisted: boolean; compact?: boolean }) {
  const { setCartCount, toast } = useApp();
  const wishlist = useWishlistToggle(product.id, wishlisted);
  const [adding, setAdding] = useState(false);
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock < 5;
  const href = `/p/${product.slug}`;

  async function addToCart() {
    setAdding(true);
    const res = await api<{ message: string; cart: CartView }>("/api/cart/items", { body: { productId: product.id, quantity: 1 } });
    setAdding(false);
    if (!res.ok) {
      toast(res.error.message, "error");
      return;
    }
    setCartCount(res.data.cart.count);
    toast(res.data.message === "Added to cart" ? `Added "${product.title}" to your cart` : res.data.message);
  }

  return (
    <article
      data-testid={`product-card-${product.slug}`}
      className={`card relative flex h-full flex-col p-3 ${compact ? "w-44 shrink-0 md:w-52" : ""}`}
    >
      <button
        type="button"
        data-testid={`wishlist-toggle-${product.slug}`}
        aria-pressed={wishlist.active}
        aria-label={wishlist.active ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
        onClick={wishlist.toggle}
        disabled={wishlist.busy}
        className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow hover:text-rose-600"
      >
        <HeartIcon filled={wishlist.active} />
      </button>
      <Link href={href} className="flex aspect-square items-center justify-center overflow-hidden rounded bg-slate-50">
        <img src={product.image} alt={product.title} loading="lazy" className="h-full w-full object-contain p-2" />
      </Link>
      <div className="mt-2 flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap gap-1">
          {product.tags.includes("bestseller") && <span className="rounded bg-orange-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">Bestseller</span>}
          {product.tags.includes("deal") && <span className="rounded bg-red-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">Deal</span>}
          {product.tags.includes("new") && <span className="rounded bg-sky-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">New</span>}
        </div>
        <Link href={href} className="block min-h-[40px] hover:text-orange-700">
          <h3 data-testid="product-card-title" className="line-clamp-2 text-sm font-medium leading-snug">
            {product.title}
          </h3>
        </Link>
        <p className="text-xs text-slate-500">{product.brand}</p>
        <div className="flex items-center gap-1 text-xs">
          <span className="sr-only">Rated {product.rating.toFixed(1)} out of 5</span>
          <Stars rating={product.rating} size={14} />
          <span className="text-brand-link">{product.ratingCount.toLocaleString("en-US")}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span data-testid="product-card-price" className="text-lg font-semibold">
            {formatMoney(product.price)}
          </span>
          {product.discountPercent > 0 && (
            <>
              <span className="text-xs text-slate-500">
                List: <s>{formatMoney(product.mrp)}</s>
              </span>
              <span className="text-xs font-semibold text-red-700">{product.discountPercent}% off</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          {product.fastDelivery && <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">Fast delivery</span>}
          {outOfStock && (
            <span data-testid="out-of-stock-badge" className="rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-700">
              Out of stock
            </span>
          )}
          {lowStock && (
            <span data-testid="low-stock-badge" className="rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-700">
              Only {product.stock} left
            </span>
          )}
        </div>
        <div className="mt-auto pt-2">
          {product.hasVariants && !outOfStock ? (
            <Link href={href} data-testid={`add-to-cart-${product.slug}`} className="btn-primary w-full">
              See options
            </Link>
          ) : (
            <button
              type="button"
              data-testid={`add-to-cart-${product.slug}`}
              onClick={addToCart}
              disabled={outOfStock || adding}
              className="btn-primary w-full"
            >
              {outOfStock ? "Out of stock" : adding ? "Adding…" : "Add to Cart"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
