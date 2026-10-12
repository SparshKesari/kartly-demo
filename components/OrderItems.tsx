import Link from "next/link";
import { variantLabel } from "@/lib/cart";
import { formatMoney, lineTotal } from "@/lib/pricing";
import type { Order } from "@/lib/types";

export function OrderItems({ order, slugs }: { order: Order; slugs: Record<string, string> }) {
  return (
    <ul className="divide-y divide-slate-200">
      {order.items.map((item, i) => (
        <li key={`${item.productId}-${i}`} className="flex gap-3 py-3">
          <img src={item.image} alt={item.title} className="h-16 w-16 shrink-0 rounded bg-slate-50 object-contain" />
          <div className="min-w-0 flex-1 text-sm">
            {slugs[item.productId] ? (
              <Link href={`/p/${slugs[item.productId]}`} className="line-clamp-2 min-h-[40px] font-medium text-brand-link hover:underline">
                {item.title}
              </Link>
            ) : (
              <p className="line-clamp-2 min-h-[40px] font-medium">{item.title}</p>
            )}
            {item.variant && <p className="text-slate-600">{variantLabel(item.variant)}</p>}
            <p>
              Qty {item.quantity} × {formatMoney(item.price)}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold">{formatMoney(lineTotal(item.price, item.quantity))}</p>
        </li>
      ))}
    </ul>
  );
}

export function ShippingAddressBlock({ order, testId }: { order: Order; testId?: string }) {
  const a = order.shippingAddress;
  return (
    <address data-testid={testId} className="text-sm not-italic leading-snug">
      <span className="font-semibold">{a.fullName}</span>
      <br />
      {a.line1}
      {a.line2 ? `, ${a.line2}` : ""}
      <br />
      {a.city}, {a.state} {a.zip}
      <br />
      {a.country}
      <br />
      Phone: {a.phone}
    </address>
  );
}

export function OrderTotals({ order, totalTestId }: { order: Order; totalTestId?: string }) {
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between ${strong ? "border-t border-slate-200 pt-2 text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span data-testid={strong ? totalTestId : undefined}>{value}</span>
    </div>
  );
  return (
    <div className="space-y-1 text-sm">
      {row("Items subtotal", formatMoney(order.subtotal))}
      {order.discount > 0 && row(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${formatMoney(order.discount)}`)}
      {row(`Shipping (${order.deliveryOption === "express" ? "Express" : "Standard"})`, formatMoney(order.shipping))}
      {row("Tax", formatMoney(order.tax))}
      {row("Order total", formatMoney(order.total), true)}
    </div>
  );
}
