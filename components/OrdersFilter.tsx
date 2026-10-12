"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function OrdersFilter({ status }: { status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="orders-status-filter" className="text-sm font-semibold">
        Show
      </label>
      <select
        id="orders-status-filter"
        data-testid="orders-status-filter"
        value={status}
        aria-busy={pending}
        onChange={(e) => {
          const v = e.target.value;
          startTransition(() => router.push(v ? `/account/orders?status=${v}` : "/account/orders"));
        }}
        className="min-h-[40px] rounded-md border border-slate-300 bg-white px-2 text-sm"
      >
        <option value="">All orders</option>
        <option value="placed">Placed</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
  );
}
