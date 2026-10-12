import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderActions } from "@/components/OrderActions";
import { OrderItems, OrderTotals, ShippingAddressBlock } from "@/components/OrderItems";
import { STATUS_LABELS, StatusBadge } from "@/components/StatusBadge";
import { read } from "@/lib/db";
import { requirePageUser } from "@/lib/guards";
import { canCancel, findUserOrder } from "@/lib/orders";
import { formatDate, formatDeliveryDate } from "@/lib/util";

export const metadata: Metadata = { title: "Order details" };

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const user = requirePageUser(`/account/orders/${params.id}`);
  const db = read();
  const order = findUserOrder(db, user.id, params.id);
  if (!order) notFound();
  const slugs = Object.fromEntries(db.products.map((p) => [p.id, p.slug]));
  const timeFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };

  return (
    <div className="mx-auto max-w-4xl px-2 py-6 md:px-4">
      <nav className="mb-3 text-sm" aria-label="Breadcrumb">
        <Link href="/account/orders" className="inline-flex min-h-[40px] items-center text-brand-link hover:underline">
          Your Orders
        </Link>{" "}
        › Order details
      </nav>
      <section data-testid="order-detail" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Order {order.orderNumber}</h1>
          <StatusBadge status={order.status} testId="order-status" />
        </div>
        <p className="text-sm text-slate-600">
          Ordered on {formatDate(order.createdAt)} · Order # <span data-testid="order-number">{order.orderNumber}</span>
        </p>

        <div className="card grid gap-4 p-4 md:grid-cols-3">
          <div>
            <h2 className="mb-1 font-semibold">Shipping address</h2>
            <ShippingAddressBlock order={order} testId="order-address" />
          </div>
          <div>
            <h2 className="mb-1 font-semibold">Payment method</h2>
            <p className="text-sm">Card ending in {order.payment.last4}</p>
            <p className="text-xs text-slate-500">Transaction {order.payment.transactionId}</p>
          </div>
          <div>
            <h2 className="mb-1 font-semibold">Order summary</h2>
            <OrderTotals order={order} totalTestId="order-total" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="card p-4">
            <h2 className="font-semibold">
              {order.status === "cancelled"
                ? "Cancelled"
                : order.status === "delivered"
                  ? "Delivered"
                  : `Estimated delivery: ${formatDeliveryDate(order.estimatedDelivery)}`}
            </h2>
            <ol data-testid="order-timeline" className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
              {order.statusHistory.map((h, i) => (
                <li key={`${h.status}-${i}`} data-testid="timeline-entry" className="relative">
                  <span aria-hidden="true" className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-amber-500" />
                  <p className="text-sm font-semibold">{STATUS_LABELS[h.status]}</p>
                  <p className="text-xs text-slate-600">{formatDate(h.at, timeFmt)} UTC</p>
                </li>
              ))}
            </ol>
            <h2 className="mt-5 font-semibold">Items</h2>
            <OrderItems order={order} slugs={slugs} />
          </div>
          <div className="card h-fit p-4">
            <OrderActions orderId={order.id} canCancel={canCancel(order)} />
          </div>
        </div>
      </section>
    </div>
  );
}
