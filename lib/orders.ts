import { ApiError } from "./api";
import { newId } from "./auth";
import { addItem, findCart, getOrCreateCart } from "./cart";
import { KB } from "./kb";
import { computeTotals, evaluateCoupon, subtotalOf } from "./pricing";
import { addDays } from "./util";
import type { Cart, DB, DeliveryOption, Order, OrderStatus, ShippingAddress } from "./types";

export const ORDERS_PAGE_SIZE = 10;
export const ORDER_STATUSES: OrderStatus[] = ["placed", "shipped", "delivered", "cancelled"];

/** Stable fingerprint of the purchasable part of a cart. */
export function cartSignature(cart: Cart | undefined): string {
  if (!cart) return "";
  const lines = cart.items
    .filter((l) => !l.savedForLater)
    .map((l) => `${l.lineId}:${l.quantity}`)
    .sort();
  return `${lines.join("|")}#${cart.couponCode ?? ""}`;
}

export function nextOrderNumber(db: DB): string {
  const max = db.orders.reduce((m, o) => Math.max(m, Number(o.orderNumber.replace(/\D/g, "")) || 0), 0);
  return `KRT-${String(max + 1).padStart(6, "0")}`;
}

export function estimateDelivery(from: Date, deliveryOption: DeliveryOption, deliveryDays: number[]): string {
  const days = deliveryOption === "express" ? 1 : Math.max(1, ...deliveryDays);
  return addDays(from, days).toISOString();
}

export type PlaceOrderInput = {
  userId: string;
  shippingAddress: ShippingAddress;
  deliveryOption: DeliveryOption;
  last4: string;
  expectedCartSignature?: string;
};

/**
 * Creates an order from the user's cart. Must be called inside a db.mutate() so the
 * stock check, stock decrement and cart update happen atomically. Throws ApiError and
 * leaves the draft untouched on any failure.
 */
export function placeOrder(db: DB, input: PlaceOrderInput): Order {
  const cart = findCart(db, { userId: input.userId });
  const lines = cart?.items.filter((l) => !l.savedForLater) ?? [];
  if (!cart || lines.length === 0) throw new ApiError(409, "cart_changed", "Your cart is empty.");
  if (input.expectedCartSignature !== undefined && cartSignature(cart) !== input.expectedCartSignature) {
    throw new ApiError(409, "cart_changed", "Your cart changed. Please review your order and try again.");
  }

  const resolved = lines.map((line) => {
    const product = db.products.find((p) => p.id === line.productId);
    if (!product) throw new ApiError(409, "out_of_stock", "An item in your cart is no longer available. Please update your cart.");
    if (line.quantity > product.stock) {
      throw new ApiError(409, "out_of_stock", `Only ${Math.max(0, product.stock)} left. Please update your cart.`, undefined, {
        productId: product.id,
        lineId: line.lineId,
      });
    }
    if (line.quantity > product.maxPerOrder) {
      throw new ApiError(409, "out_of_stock", `Limit ${product.maxPerOrder} per order. Please update your cart.`);
    }
    return { line, product };
  });

  if (input.deliveryOption === "express" && resolved.some((r) => !r.product.fastDelivery)) {
    throw new ApiError(422, "unprocessable", "Express delivery is not available for every item in your cart.");
  }

  const items = resolved.map(({ line, product }) => {
    const item: Order["items"][number] = {
      productId: product.id,
      title: product.title,
      image: product.images[0] ?? "",
      price: product.price,
      quantity: line.quantity,
    };
    if (line.variant) item.variant = { ...line.variant };
    return item;
  });

  const subtotal = subtotalOf(items);
  const evaluation = cart.couponCode ? evaluateCoupon(cart.couponCode, db.coupons, subtotal) : undefined;
  const coupon = evaluation?.status === "applied" ? evaluation.coupon : undefined;
  const totals = computeTotals({ subtotal, coupon, deliveryOption: input.deliveryOption });

  for (const { line, product } of resolved) product.stock -= line.quantity;
  const orderedIds = new Set(lines.map((l) => l.lineId));
  cart.items = cart.items.filter((l) => l.savedForLater || !orderedIds.has(l.lineId));
  delete cart.couponCode;
  const now = new Date();
  cart.updatedAt = now.toISOString();

  const order: Order = {
    id: newId("o"),
    orderNumber: nextOrderNumber(db),
    userId: input.userId,
    items,
    shippingAddress: { ...input.shippingAddress },
    deliveryOption: input.deliveryOption,
    payment: { method: "card", last4: input.last4, status: "paid", transactionId: newId("txn") },
    ...totals,
    status: "placed",
    statusHistory: [{ status: "placed", at: now.toISOString() }],
    estimatedDelivery: estimateDelivery(now, input.deliveryOption, resolved.map((r) => r.product.deliveryDays)),
    createdAt: now.toISOString(),
  };
  if (coupon) order.couponCode = coupon.code;
  db.orders.push(order);
  return order;
}

/** Finds an order by id or order number, only if it belongs to the user. */
export function findUserOrder(db: DB, userId: string, idOrNumber: string): Order | undefined {
  const key = decodeURIComponent(idOrNumber);
  return db.orders.find((o) => (KB.b03 || o.userId === userId) && (o.id === key || o.orderNumber.toUpperCase() === key.toUpperCase()));
}

export function requireUserOrder(db: DB, userId: string, idOrNumber: string): Order {
  const order = findUserOrder(db, userId, idOrNumber);
  if (!order) throw new ApiError(404, "not_found", "Order not found.");
  return order;
}

export function listOrders(db: DB, userId: string, status: OrderStatus | undefined, page: number) {
  const all = db.orders
    .filter((o) => o.userId === userId && (!status || o.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.orderNumber.localeCompare(a.orderNumber));
  const totalPages = Math.max(1, Math.ceil(all.length / ORDERS_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    orders: all.slice((current - 1) * ORDERS_PAGE_SIZE, current * ORDERS_PAGE_SIZE),
    total: all.length,
    page: current,
    totalPages,
    pageSize: ORDERS_PAGE_SIZE,
  };
}

export function canCancel(order: Order): boolean {
  return order.status === "placed";
}

/** Cancels a placed order and restores stock. Call inside db.mutate(). */
export function cancelOrder(db: DB, userId: string, idOrNumber: string): Order {
  const order = requireUserOrder(db, userId, idOrNumber);
  if (!canCancel(order)) throw new ApiError(409, "conflict", `This order can no longer be cancelled (status: ${order.status}).`);
  for (const item of order.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (product && !KB.b06) product.stock += item.quantity;
  }
  order.status = "cancelled";
  order.statusHistory.push({ status: "cancelled", at: new Date().toISOString() });
  return order;
}

export type BuyAgainResult = { added: number; skipped: string[]; adjusted: string[] };

/** Adds an order's items back to the user's cart, respecting current stock. Call inside db.mutate(). */
export function buyAgain(db: DB, userId: string, idOrNumber: string): BuyAgainResult {
  const order = requireUserOrder(db, userId, idOrNumber);
  const cart = getOrCreateCart(db, { userId });
  const result: BuyAgainResult = { added: 0, skipped: [], adjusted: [] };
  for (const item of order.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (!product || product.stock <= 0) {
      result.skipped.push(item.title);
      continue;
    }
    try {
      const r = addItem(db, cart, item.productId, item.quantity, item.variant);
      result.added += r.added;
      if (r.capped) result.adjusted.push(item.title);
    } catch (err) {
      if (err instanceof ApiError) result.skipped.push(item.title);
      else throw err;
    }
  }
  if (result.added === 0) {
    throw new ApiError(409, "out_of_stock", "None of the items from this order can be added right now.", undefined, { skipped: result.skipped });
  }
  return result;
}
