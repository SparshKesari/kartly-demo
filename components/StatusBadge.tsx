import type { OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  placed: "bg-sky-100 text-sky-800",
  shipped: "bg-amber-100 text-amber-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-700",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function StatusBadge({ status, testId }: { status: OrderStatus; testId?: string }) {
  return (
    <span data-testid={testId} data-status={status} className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
