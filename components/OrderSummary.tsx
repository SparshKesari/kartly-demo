import type { Totals } from "@/lib/pricing";
import { formatMoney } from "@/lib/pricing";

export function OrderSummary({
  totals,
  couponCode,
  shippingLabel = "Shipping",
  totalTestId = "summary-total",
  title = "Order summary",
}: {
  totals: Totals;
  couponCode?: string;
  shippingLabel?: string;
  totalTestId?: string;
  title?: string;
}) {
  return (
    <div className="space-y-1 text-sm">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span data-testid="summary-subtotal">{formatMoney(totals.subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span>Discount{couponCode ? ` (${couponCode})` : ""}</span>
        <span className={totals.discount > 0 ? "text-emerald-700" : ""}>
          {totals.discount > 0 ? "-" : ""}
          <span data-testid="summary-discount">{formatMoney(totals.discount)}</span>
        </span>
      </div>
      <div className="flex justify-between">
        <span>{shippingLabel}</span>
        <span data-testid="summary-shipping">{formatMoney(totals.shipping)}</span>
      </div>
      <div className="flex justify-between">
        <span>Estimated tax (8%)</span>
        <span data-testid="summary-tax">{formatMoney(totals.tax)}</span>
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-brand-price">
        <span>Order total</span>
        <span data-testid={totalTestId}>{formatMoney(totals.total)}</span>
      </div>
    </div>
  );
}
