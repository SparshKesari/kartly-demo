import type { Metadata } from "next";
import Link from "next/link";
import { OrdersFilter } from "@/components/OrdersFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { read } from "@/lib/db";
import { requirePageUser } from "@/lib/guards";
import { ORDER_STATUSES, listOrders } from "@/lib/orders";
import { formatMoney } from "@/lib/pricing";
import type { OrderStatus } from "@/lib/types";
import { formatDate, formatDeliveryDate } from "@/lib/util";

export const metadata: Metadata = { title: "Your Orders" };

type Props = { searchParams: { status?: string; page?: string } };

export default function OrdersPage({ searchParams }: Props) {
  const qs = new URLSearchParams();
  if (searchParams.status) qs.set("status", searchParams.status);
  if (searchParams.page) qs.set("page", searchParams.page);
  const user = requirePageUser(`/account/orders${qs.toString() ? `?${qs}` : ""}`);
  const status = ORDER_STATUSES.includes(searchParams.status as OrderStatus) ? (searchParams.status as OrderStatus) : undefined;
  const pageNum = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const result = listOrders(read(), user.id, status, pageNum);
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    return `/account/orders${sp.toString() ? `?${sp}` : ""}`;
  };
  const linkClass = "flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50";
  const disabledClass = "flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400";

  return (
    <div className="mx-auto max-w-4xl px-2 py-6 md:px-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your Orders</h1>
        <OrdersFilter status={status ?? ""} />
      </div>
      <p className="mb-3 text-sm text-slate-600" data-testid="orders-count">
        {result.total} {result.total === 1 ? "order" : "orders"}
        {status ? ` with status "${status}"` : ""}
      </p>
      {result.orders.length === 0 ? (
        <div data-testid="empty-orders" className="card p-8 text-center">
          <p className="text-lg font-semibold">{status ? "No orders with this status." : "You haven't placed any orders yet."}</p>
          <Link href="/" className="btn-primary mt-4">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {result.orders.map((o) => (
            <li key={o.id} data-testid={`order-row-${o.orderNumber}`} className="card overflow-hidden">
              <div className="flex flex-wrap gap-x-6 gap-y-1 bg-slate-100 px-4 py-2 text-xs text-slate-700">
                <span>
                  ORDER PLACED <strong className="block text-sm">{formatDate(o.createdAt)}</strong>
                </span>
                <span>
                  TOTAL <strong className="block text-sm">{formatMoney(o.total)}</strong>
                </span>
                <span>
                  SHIP TO <strong className="block text-sm">{o.shippingAddress.fullName}</strong>
                </span>
                <span className="ml-auto text-right">
                  ORDER # <strong className="block text-sm">{o.orderNumber}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} testId="order-row-status" />
                    <span className="text-sm text-slate-600">
                      {o.status === "delivered"
                        ? `Delivered ${formatDate(o.statusHistory.find((h) => h.status === "delivered")?.at ?? o.estimatedDelivery)}`
                        : o.status === "cancelled"
                          ? "This order was cancelled"
                          : `Arriving ${formatDeliveryDate(o.estimatedDelivery)}`}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">
                    {o.items.map((i) => i.title).join(", ")} ({o.items.reduce((n, i) => n + i.quantity, 0)} items)
                  </p>
                </div>
                <div className="flex -space-x-2">
                  {o.items.slice(0, 3).map((i, idx) => (
                    <img key={idx} src={i.image} alt={i.title} className="h-12 w-12 rounded border border-white bg-slate-50 object-contain" />
                  ))}
                </div>
                <Link href={`/account/orders/${o.id}`} className="btn-outline">
                  View order details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {result.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} data-testid="pagination-prev" className={linkClass}>
              ‹ Previous
            </Link>
          ) : (
            <button type="button" disabled data-testid="pagination-prev" className={disabledClass}>
              ‹ Previous
            </button>
          )}
          {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) =>
            p === result.page ? (
              <span key={p} data-testid={`pagination-page-${p}`} aria-current="page" className={`${linkClass} border-slate-800 font-bold`}>
                {p}
              </span>
            ) : (
              <Link key={p} href={href(p)} data-testid={`pagination-page-${p}`} className={linkClass}>
                {p}
              </Link>
            ),
          )}
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} data-testid="pagination-next" className={linkClass}>
              Next ›
            </Link>
          ) : (
            <button type="button" disabled data-testid="pagination-next" className={disabledClass}>
              Next ›
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
