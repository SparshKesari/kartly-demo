import { KB } from "./kb";
import type { Coupon, DeliveryOption } from "./types";

export const TAX_RATE = 0.08;
export const FREE_SHIPPING_THRESHOLD = 35;
export const STANDARD_SHIPPING = 5.99;
export const EXPRESS_SHIPPING = 9.99;

/** Rounds to 2 decimals, half up (away from zero), tolerant of binary float error. */
export function round2(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.round(Math.abs(value) * 100 + 1e-7);
  return (sign * cents) / 100;
}

export function formatMoney(value: number): string {
  const v = round2(value);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
}

/** Discount percent shown on cards: round((mrp - price) / mrp x 100). */
export function discountPercent(price: number, mrp: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function lineTotal(price: number, quantity: number): number {
  return round2(price * quantity);
}

export function subtotalOf(lines: { price: number; quantity: number }[]): number {
  return round2(lines.reduce((sum, l) => sum + round2(l.price * l.quantity), 0));
}

export type CouponStatus = "applied" | "invalid" | "expired" | "min_not_met";

export type CouponEvaluation = {
  code: string;
  status: CouponStatus;
  message: string;
  coupon?: Coupon;
};

export function isCouponExpired(coupon: Coupon, now: Date = new Date()): boolean {
  return new Date(coupon.expiresAt).getTime() <= now.getTime();
}

/** Evaluates a coupon against the subtotal before discount. */
export function evaluateCoupon(
  code: string,
  coupons: Coupon[],
  subtotal: number,
  now: Date = new Date(),
): CouponEvaluation {
  const normalized = code.trim().toUpperCase();
  const coupon = coupons.find((c) => c.code.toUpperCase() === normalized);
  if (!coupon || !coupon.active) {
    return { code: normalized, status: "invalid", message: "This coupon code is invalid." };
  }
  if (isCouponExpired(coupon, now)) {
    return { code: coupon.code, status: "expired", message: "This coupon has expired.", coupon };
  }
  if (subtotal < coupon.minSubtotal) {
    const missing = round2(coupon.minSubtotal - subtotal);
    return {
      code: coupon.code,
      status: "min_not_met",
      message: `Add ${formatMoney(missing)} more to use this coupon.`,
      coupon,
    };
  }
  return { code: coupon.code, status: "applied", message: `Coupon ${coupon.code} applied.`, coupon };
}

export function couponDiscount(coupon: Coupon | undefined, subtotal: number): number {
  if (!coupon) return 0;
  if (coupon.type === "percent") return Math.min(subtotal, round2((subtotal * coupon.value) / 100));
  if (coupon.type === "flat") return Math.min(subtotal, round2(coupon.value));
  return 0;
}

export type Totals = {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
};

/**
 * Computes order totals. `coupon` must already be validated as applicable
 * (see evaluateCoupon); pass undefined when no coupon applies.
 */
export function computeTotals(input: {
  subtotal: number;
  coupon?: Coupon;
  deliveryOption: DeliveryOption;
}): Totals {
  const subtotal = round2(input.subtotal);
  const discount = round2(couponDiscount(input.coupon, subtotal));
  const discounted = round2(subtotal - discount);
  let shipping: number;
  if (subtotal <= 0) {
    shipping = 0;
  } else if (input.deliveryOption === "express") {
    shipping = EXPRESS_SHIPPING;
  } else if (input.coupon?.type === "freeship" || discounted >= FREE_SHIPPING_THRESHOLD) {
    shipping = 0;
  } else {
    shipping = STANDARD_SHIPPING;
  }
  const tax = round2((KB.b04 ? subtotal : discounted) * TAX_RATE);
  const total = round2(discounted + shipping + tax);
  return { subtotal, discount, shipping, tax, total };
}
