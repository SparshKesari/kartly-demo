"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { CartLineView, CartView } from "@/lib/cart";
import { api, loginUrl } from "@/lib/client";
import { KB } from "@/lib/kb";
import { formatMoney } from "@/lib/pricing";
import { useApp } from "./Providers";
import { OrderSummary } from "./OrderSummary";

type MutationResult = { cart: CartView };

export function CartClient({ initial, signedIn }: { initial: CartView; signedIn: boolean }) {
  const router = useRouter();
  const { setCartCount, toast } = useApp();
  const [view, setView] = useState(initial);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [appliedMessage, setAppliedMessage] = useState("");

  useEffect(() => {
    setView(initial);
  }, [initial]);

  function apply(next: CartView) {
    setView(next);
    setCartCount(next.count);
  }

  async function mutate(lineId: string, url: string, method: string, body?: unknown, success?: string) {
    setBusyLine(lineId);
    const res = await api<MutationResult>(url, { method, body });
    setBusyLine(null);
    if (!res.ok) {
      toast(res.error.message, "error");
      return false;
    }
    setCouponError("");
    apply(res.data.cart);
    if (success) toast(success, "info");
    return true;
  }

  const lineUrl = (lineId: string) => `/api/cart/items/${encodeURIComponent(lineId)}`;
  const setQty = (line: CartLineView, quantity: number) => mutate(line.lineId, lineUrl(line.lineId), "PATCH", { quantity });
  const remove = (line: CartLineView) => {
    const target = KB.b12 && !line.savedForLater && view.items.length > 0 && window.matchMedia("(max-width: 639px)").matches ? view.items[0] : line;
    return mutate(line.lineId, lineUrl(target.lineId), "DELETE", undefined, `Removed "${line.title}" from your cart`);
  };
  const saveForLater = (line: CartLineView, saved: boolean) =>
    mutate(line.lineId, lineUrl(line.lineId), "PATCH", { savedForLater: saved }, saved ? `Saved "${line.title}" for later` : `Moved "${line.title}" to your cart`);

  async function applyCoupon(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setCouponError("Enter a coupon code.");
      return;
    }
    setCouponBusy(true);
    const res = await api<MutationResult>("/api/cart/coupon", { body: { code } });
    setCouponBusy(false);
    if (!res.ok) {
      setCouponError(res.error.message);
      return;
    }
    setCouponError("");
    setCode("");
    if (KB.b09) setAppliedMessage(res.data.cart.coupon?.status === "applied" ? res.data.cart.coupon.message : "");
    apply(res.data.cart);
  }

  async function removeCouponCode() {
    setCouponBusy(true);
    const res = await api<MutationResult>("/api/cart/coupon", { method: "DELETE" });
    setCouponBusy(false);
    if (!res.ok) {
      toast(res.error.message, "error");
      return;
    }
    setCouponError("");
    setAppliedMessage("");
    apply(res.data.cart);
    toast("Coupon removed", "info");
  }

  function checkout() {
    router.push(signedIn ? "/checkout" : loginUrl("/checkout"));
  }

  const stickyMessage = KB.b09 && view.coupon ? appliedMessage : "";
  const couponMessage = couponError || stickyMessage || view.coupon?.message || "";
  const couponTone = couponError ? "error" : stickyMessage || view.coupon?.status === "applied" ? "success" : view.coupon ? "error" : "";
  const empty = view.items.length === 0;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-4 px-2 py-4 md:px-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <section className="card p-4" aria-labelledby="cart-title">
          <h1 id="cart-title" className="border-b border-slate-200 pb-2 text-2xl font-semibold">
            Shopping Cart
          </h1>
          {empty ? (
            <div data-testid="empty-cart" className="py-8 text-center">
              <p className="text-lg font-semibold">Your Kartly Cart is empty</p>
              <p className="mt-1 text-sm text-slate-600">Browse today&apos;s deals and find something you love.</p>
              <Link href="/" className="btn-primary mt-4">
                Continue shopping
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {view.items.map((line) => (
                <li key={line.lineId} data-testid={`cart-item-${line.lineId}`} className={`flex gap-3 py-4 ${busyLine === line.lineId ? "opacity-60" : ""}`}>
                  <Link href={`/p/${line.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded bg-slate-50 md:h-32 md:w-32">
                    <img src={line.image} alt={line.title} className="h-full w-full object-contain p-1" />
                  </Link>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-col justify-between gap-1 sm:flex-row">
                      <Link href={`/p/${line.slug}`} className="line-clamp-2 min-h-[40px] font-medium hover:text-orange-700">
                        {line.title}
                      </Link>
                      <span className="shrink-0 font-semibold sm:text-right" aria-label="Unit price">
                        {formatMoney(line.price)}
                      </span>
                    </div>
                    {line.variantLabel && <p className="text-sm text-slate-600">{line.variantLabel}</p>}
                    <p className={`text-xs ${line.stock > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {line.stock <= 0 ? "Out of stock" : line.stock < 5 ? `Only ${line.stock} left in stock` : "In stock"}
                    </p>
                    {line.warning && (
                      <p data-testid={`cart-item-warning-${line.lineId}`} role="alert" className="rounded border border-red-300 bg-red-50 px-2 py-1 text-sm text-red-800">
                        {line.warning}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <div className="flex items-center rounded-full border-2 border-amber-400" role="group" aria-label={`Quantity for ${line.title}`}>
                        <button
                          type="button"
                          data-testid={`qty-decrease-${line.lineId}`}
                          aria-label="Decrease quantity"
                          disabled={busyLine !== null || line.quantity <= 1}
                          onClick={() => setQty(line, line.quantity - 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-l-full text-lg disabled:opacity-40"
                        >
                          −
                        </button>
                        <span data-testid={`cart-item-qty-${line.lineId}`} aria-live="polite" className="min-w-[2rem] text-center font-semibold">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          data-testid={`qty-increase-${line.lineId}`}
                          aria-label="Increase quantity"
                          disabled={busyLine !== null || line.quantity >= line.maxQty}
                          onClick={() => setQty(line, line.quantity + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-r-full text-lg disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <button type="button" data-testid={`remove-item-${line.lineId}`} disabled={busyLine !== null} onClick={() => remove(line)} className="btn-link px-2">
                        Delete
                      </button>
                      <button
                        type="button"
                        data-testid={`save-for-later-${line.lineId}`}
                        disabled={busyLine !== null}
                        onClick={() => saveForLater(line, true)}
                        className="btn-link px-2"
                      >
                        Save for later
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!empty && (
            <p className="border-t border-slate-200 pt-3 text-right text-lg">
              Subtotal ({view.count} {view.count === 1 ? "item" : "items"}): <span className="font-bold">{formatMoney(view.totals.subtotal)}</span>
            </p>
          )}
        </section>

        {view.saved.length > 0 && (
          <section className="card p-4" aria-labelledby="saved-title">
            <h2 id="saved-title" className="border-b border-slate-200 pb-2 text-xl font-semibold">
              Saved for later ({view.saved.length} {view.saved.length === 1 ? "item" : "items"})
            </h2>
            <ul className="grid gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-3">
              {view.saved.map((line) => (
                <li key={line.lineId} data-testid={`saved-item-${line.lineId}`} className="flex gap-3 rounded-md border border-slate-200 p-3">
                  <Link href={`/p/${line.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded bg-slate-50">
                    <img src={line.image} alt={line.title} className="h-full w-full object-contain p-1" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${line.slug}`} className="line-clamp-2 min-h-[40px] text-sm font-medium hover:text-orange-700">
                      {line.title}
                    </Link>
                    {line.variantLabel && <p className="text-xs text-slate-600">{line.variantLabel}</p>}
                    <p className="text-sm font-semibold">{formatMoney(line.price)}</p>
                    <div className="flex flex-wrap gap-x-2">
                      <button
                        type="button"
                        data-testid={`move-to-cart-${line.lineId}`}
                        disabled={busyLine !== null}
                        onClick={() => saveForLater(line, false)}
                        className="btn-link"
                      >
                        Move to cart
                      </button>
                      <button type="button" data-testid={`remove-item-${line.lineId}`} disabled={busyLine !== null} onClick={() => remove(line)} className="btn-link">
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="space-y-4" aria-label="Order summary">
        <section className="card space-y-3 p-4">
          <form onSubmit={applyCoupon} className="space-y-2" aria-label="Coupon">
            <label htmlFor="coupon-input" className="label">
              Have a coupon?
            </label>
            <div className="flex gap-2">
              <input
                id="coupon-input"
                data-testid="coupon-input"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCouponError("");
                }}
                placeholder="Enter code"
                autoCapitalize="characters"
                className="input uppercase"
                disabled={empty && !view.coupon}
              />
              <button type="submit" data-testid="apply-coupon-btn" disabled={couponBusy || (empty && !view.coupon)} className="btn-outline shrink-0">
                Apply
              </button>
            </div>
            {couponMessage && (
              <p
                data-testid="coupon-message"
                role="status"
                className={`text-sm ${couponTone === "success" ? "text-emerald-700" : "text-red-700"}`}
              >
                {couponMessage}
              </p>
            )}
            {view.coupon && (
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 text-sm">
                <span>
                  Code: <strong>{view.coupon.code}</strong>
                </span>
                <button type="button" data-testid="remove-coupon-btn" onClick={removeCouponCode} disabled={couponBusy} className="btn-link">
                  Remove
                </button>
              </div>
            )}
          </form>
          <OrderSummary totals={view.totals} couponCode={view.coupon?.status === "applied" ? view.coupon.code : undefined} />
          <button type="button" data-testid="checkout-btn" disabled={empty || view.hasIssues} onClick={checkout} className="btn-primary w-full">
            Proceed to checkout
          </button>
          {view.hasIssues && (
            <p className="text-sm text-red-700" role="alert">
              Some items need your attention. Update the highlighted items to continue.
            </p>
          )}
          {!view.hasIssues && !empty && view.totals.shipping > 0 && (
            <p className="text-xs text-slate-600">Add {formatMoney(Math.max(0, 35 - (view.totals.subtotal - view.totals.discount)))} more for FREE standard shipping.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
