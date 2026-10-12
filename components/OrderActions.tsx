"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CartView } from "@/lib/cart";
import { api } from "@/lib/client";
import { useApp } from "./Providers";

export function OrderActions({ orderId, canCancel }: { orderId: string; canCancel: boolean }) {
  const router = useRouter();
  const { setCartCount, toast } = useApp();
  const [busy, setBusy] = useState<"cancel" | "again" | null>(null);

  async function cancel() {
    if (busy) return;
    setBusy("cancel");
    const res = await api(`/api/orders/${orderId}/cancel`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      toast(res.error.message, "error");
      return;
    }
    toast("Your order has been cancelled.", "info");
    router.refresh();
  }

  async function buyAgain() {
    if (busy) return;
    setBusy("again");
    const res = await api<{ added: number; skipped: string[]; adjusted: string[]; cart: CartView }>(`/api/orders/${orderId}/buy-again`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      toast(res.error.message, "error");
      return;
    }
    setCartCount(res.data.cart.count);
    const parts = [`Added ${res.data.added} ${res.data.added === 1 ? "item" : "items"} to your cart.`];
    if (res.data.skipped.length) parts.push(`Unavailable: ${res.data.skipped.join(", ")}.`);
    if (res.data.adjusted.length) parts.push(`Quantity limited by stock: ${res.data.adjusted.join(", ")}.`);
    toast(parts.join(" "));
    router.push("/cart");
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" data-testid="buy-again-btn" onClick={buyAgain} disabled={busy !== null} className="btn-primary w-full">
        {busy === "again" ? "Adding…" : "Buy it again"}
      </button>
      {canCancel && (
        <button type="button" data-testid="cancel-order-btn" onClick={cancel} disabled={busy !== null} className="btn-outline w-full">
          {busy === "cancel" ? "Cancelling…" : "Cancel order"}
        </button>
      )}
    </div>
  );
}
