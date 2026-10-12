import type { Metadata } from "next";
import { CartClient } from "@/components/CartClient";
import { getCurrentUser, getGuestId } from "@/lib/auth";
import { buildCartView, findCart } from "@/lib/cart";
import { read } from "@/lib/db";

export const metadata: Metadata = { title: "Shopping Cart" };

export default function CartPage() {
  const db = read();
  const user = getCurrentUser();
  const owner = user ? { userId: user.id } : { guestId: getGuestId() };
  const view = buildCartView(db, findCart(db, owner));
  return <CartClient initial={view} signedIn={Boolean(user)} />;
}
