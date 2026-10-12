import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutClient } from "@/components/CheckoutClient";
import { buildCartView, findCart } from "@/lib/cart";
import { read } from "@/lib/db";
import { requirePageUser } from "@/lib/guards";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  const user = requirePageUser("/checkout");
  const db = read();
  const cart = buildCartView(db, findCart(db, { userId: user.id }));
  const addresses = db.addresses
    .filter((a) => a.userId === user.id)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <div data-testid="checkout-empty" className="card p-8">
          <h1 className="text-2xl font-semibold">Your cart is empty</h1>
          <p className="mt-2 text-slate-600">Add something to your cart before checking out.</p>
          <Link href="/" className="btn-primary mt-4">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  if (cart.hasIssues) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <div data-testid="checkout-blocked" className="card p-8">
          <h1 className="text-2xl font-semibold">Some items need your attention</h1>
          <p className="mt-2 text-slate-600">One or more items in your cart are out of stock or over the available quantity.</p>
          <Link href="/cart" className="btn-primary mt-4">
            Review your cart
          </Link>
        </div>
      </div>
    );
  }

  return <CheckoutClient initialAddresses={addresses} cart={cart} />;
}
