import { describe, expect, it } from "vitest";
import { computeTotals, discountPercent, evaluateCoupon, formatMoney, round2 } from "./pricing";
import type { Coupon, DeliveryOption } from "./types";

const coupons: Coupon[] = [
  { code: "SAVE10", type: "percent", value: 10, minSubtotal: 50, expiresAt: "2099-12-31T23:59:59.000Z", active: true },
  { code: "FLAT20", type: "flat", value: 20, minSubtotal: 100, expiresAt: "2099-12-31T23:59:59.000Z", active: true },
  { code: "FREESHIP", type: "freeship", value: 0, minSubtotal: 0, expiresAt: "2099-12-31T23:59:59.000Z", active: true },
  { code: "EXPIRED15", type: "percent", value: 15, minSubtotal: 0, expiresAt: "2024-01-01T00:00:00.000Z", active: true },
];

function quote(subtotal: number, code: string | null, deliveryOption: DeliveryOption) {
  const evaluation = code ? evaluateCoupon(code, coupons, subtotal) : null;
  if (evaluation && evaluation.status !== "applied") return { rejected: evaluation.message };
  return computeTotals({ subtotal, coupon: evaluation?.coupon, deliveryOption });
}

describe("pricing worked examples (section 7)", () => {
  const cases: [number, string | null, DeliveryOption, number, number, number, number][] = [
    [30, null, "standard", 0, 5.99, 2.4, 38.39],
    [35, null, "standard", 0, 0, 2.8, 37.8],
    [30, null, "express", 0, 9.99, 2.4, 42.39],
    [120, "SAVE10", "standard", 12, 0, 8.64, 116.64],
    [52, "SAVE10", "standard", 5.2, 0, 3.74, 50.54],
    [100, "FLAT20", "standard", 20, 0, 6.4, 86.4],
    [20, "FREESHIP", "standard", 0, 0, 1.6, 21.6],
    [20, "FREESHIP", "express", 0, 9.99, 1.6, 31.59],
  ];

  it.each(cases)("subtotal %d coupon %s %s", (subtotal, code, delivery, discount, shipping, tax, total) => {
    expect(quote(subtotal, code, delivery)).toEqual({ subtotal, discount, shipping, tax, total });
  });

  it("rejects SAVE10 under the minimum with the amount missing", () => {
    expect(quote(40, "SAVE10", "standard")).toEqual({ rejected: "Add $10.00 more to use this coupon." });
  });

  it("rejects expired coupons", () => {
    expect(evaluateCoupon("EXPIRED15", coupons, 500).message).toBe("This coupon has expired.");
  });

  it("rejects unknown coupons", () => {
    expect(evaluateCoupon("NOPE", coupons, 500).status).toBe("invalid");
  });

  it("matches coupon codes case-insensitively", () => {
    expect(evaluateCoupon("save10", coupons, 60).status).toBe("applied");
  });
});

describe("helpers", () => {
  it("rounds half up", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(3.744)).toBe(3.74);
    expect(round2(3.745)).toBe(3.75);
    expect(round2(2.675)).toBe(2.68);
  });

  it("formats money without thousands separators", () => {
    expect(formatMoney(116.64)).toBe("$116.64");
    expect(formatMoney(1899.99)).toBe("$1899.99");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("computes the displayed discount percent", () => {
    expect(discountPercent(9.99, 11.16)).toBe(10);
    expect(discountPercent(10, 10)).toBe(0);
  });
});
