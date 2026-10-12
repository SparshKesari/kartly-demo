import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderItems, OrderTotals, ShippingAddressBlock } from "@/components/OrderItems";
import { read } from "@/lib/db";
import { requirePageUser } from "@/lib/guards";
import { findUserOrder } from "@/lib/orders";
import { formatDeliveryDate } from "@/lib/util";

export const metadata: Metadata = { title: "Order placed" };

export default function ConfirmationPage({ params }: { params: { id: string } }) {
  const user = requirePageUser(`/order/${params.id}/confirmation`);
  const db = read();
  const order = findUserOrder(db, user.id, params.id);
  if (!order) notFound();
  const slugs = Object.fromEntries(db.products.map((p) => [p.id, p.slug]));

  return (
    <div className="mx-auto max-w-3xl px-2 py-6 md:px-4">
      <section data-testid="order-confirmation" className="card space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xl text-white">
            ✓
          </span>
          <div>
            <h1 className="text-2xl font-bold text-emerald-800">Order placed, thank you!</h1>
            <p className="text-sm text-slate-700">
              Order number <strong data-testid="order-number">{order.orderNumber}</strong>. A confirmation has been sent to {user.email}.
            </p>
          </div>
        </div>
        <p data-testid="order-delivery-estimate" className="rounded-md bg-emerald-50 p-3 text-sm">
          Estimated delivery: <strong>{formatDeliveryDate(order.estimatedDelivery)}</strong> ({order.deliveryOption === "express" ? "Express" : "Standard"} delivery)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 font-semibold">Shipping to</h2>
            <ShippingAddressBlock order={order} testId="order-address" />
          </div>
          <div>
            <h2 className="mb-1 font-semibold">Payment</h2>
            <p className="text-sm">Card ending in {order.payment.last4}</p>
            <div className="mt-3">
              <OrderTotals order={order} totalTestId="order-total" />
            </div>
          </div>
        </div>
        <div>
          <h2 className="font-semibold">Items</h2>
          <OrderItems order={order} slugs={slugs} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/account/orders/${order.id}`} className="btn-primary">
            View order details
          </Link>
          <Link href="/" className="btn-outline">
            Continue shopping
          </Link>
        </div>
      </section>
    </div>
  );
}
