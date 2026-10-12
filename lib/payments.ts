import crypto from "crypto";
import { z } from "zod";
import { ApiError } from "./api";
import { newId } from "./auth";
import { buildCartView, findCart } from "./cart";
import {
  DECLINED_CARD,
  DECLINED_MESSAGE,
  SUCCESS_CARD,
  UNSUPPORTED_MESSAGE,
  digitsOnly,
  validateCard,
} from "./card";
import { mutate, onReset, read, readLocked } from "./db";
import { KB } from "./kb";
import { cartSignature, placeOrder } from "./orders";
import type { Address, DB, DeliveryOption, ShippingAddress } from "./types";

export const OTP_CODE = "123456";
export const MAX_OTP_ATTEMPTS = 3;

export const paymentSchema = z.object({
  cardNumber: z.string().max(40),
  nameOnCard: z.string().max(100),
  expiry: z.string().max(10),
  cvv: z.string().max(10),
  deliveryOption: z.enum(["standard", "express"]),
  addressId: z.string().min(1).max(100),
});

export const verifyOtpSchema = z.object({
  paymentId: z.string().min(1).max(100),
  otp: z.string().max(20),
});

export const idempotencyKeySchema = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);

type PaymentStatus = "pending" | "failed" | "succeeded";

type Payment = {
  paymentId: string;
  userId: string;
  idempotencyKey: string;
  fingerprint: string;
  address: ShippingAddress;
  deliveryOption: DeliveryOption;
  last4: string;
  cartSignature: string;
  attempts: number;
  status: PaymentStatus;
  orderId?: string;
  createdAt: number;
};

type PaymentState = { payments: Map<string, Payment>; byKey: Map<string, string> };

const globalKey = "__kartlyPayments";
const g = globalThis as unknown as Record<string, PaymentState | undefined>;

function store(): PaymentState {
  let s = g[globalKey];
  if (!s) {
    s = { payments: new Map(), byKey: new Map() };
    g[globalKey] = s;
    onReset(clearPayments);
  }
  return s;
}

/** Clears all in-memory payment state (used by the dev reset endpoint). */
export function clearPayments(): void {
  const s = g[globalKey];
  if (!s) return;
  s.payments.clear();
  s.byKey.clear();
}

export function shippingFromAddress(a: Address): ShippingAddress {
  const snap: ShippingAddress = { fullName: a.fullName, phone: a.phone, line1: a.line1, city: a.city, state: a.state, zip: a.zip, country: a.country };
  if (a.line2) snap.line2 = a.line2;
  return snap;
}

function fingerprintOf(parts: unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** Validates that the cart can be checked out with the given delivery option. */
export function assertCartReady(db: DB, userId: string, deliveryOption: DeliveryOption) {
  const cart = findCart(db, { userId });
  const view = buildCartView(db, cart, deliveryOption);
  if (!cart || view.items.length === 0) throw new ApiError(409, "cart_changed", "Your cart is empty.");
  if (view.hasIssues) {
    const first = view.items.find((i) => i.warning);
    throw new ApiError(409, "out_of_stock", first?.warning ?? "Some items in your cart need attention.");
  }
  if (deliveryOption === "express" && !view.expressAvailable) {
    throw new ApiError(422, "unprocessable", "Express delivery is not available for every item in your cart.");
  }
  return { cart, view };
}

export function requireAddress(db: DB, userId: string, addressId: string): Address {
  const address = db.addresses.find((a) => a.id === addressId && a.userId === userId);
  if (!address) throw new ApiError(404, "not_found", "Address not found.");
  return address;
}

export type PaymentResult = { paymentId: string; otpRequired: boolean; orderId?: string };

/**
 * Starts (or resumes) a payment for the current checkout attempt.
 * The same idempotency key with the same details returns the same payment;
 * changed details (address, delivery, card, cart) start a new payment.
 */
export function startPayment(userId: string, idempotencyKey: string, input: z.infer<typeof paymentSchema>): PaymentResult {
  const errors = validateCard(input);
  if (Object.keys(errors).length) {
    throw new ApiError(400, "validation_error", "Please check your card details.", errors as Record<string, string>);
  }
  const s = store();
  const keyId = `${userId}:${idempotencyKey}`;
  const existingId = s.byKey.get(keyId);
  const existing = existingId ? s.payments.get(existingId) : undefined;
  if (existing?.status === "succeeded") {
    return { paymentId: existing.paymentId, otpRequired: false, orderId: existing.orderId };
  }

  const db = read();
  const address = requireAddress(db, userId, input.addressId);
  const { cart } = assertCartReady(db, userId, input.deliveryOption);
  const number = digitsOnly(input.cardNumber);
  const shipping = shippingFromAddress(address);
  const signature = cartSignature(cart);
  const fingerprint = fingerprintOf([
    address.id,
    shipping,
    input.deliveryOption,
    number.slice(0, 6),
    number.slice(-4),
    input.expiry.trim(),
    input.nameOnCard.trim(),
    signature,
  ]);

  if (existing?.status === "pending" && (KB.b01 ? existing.last4 === number.slice(-4) : existing.fingerprint === fingerprint)) {
    return { paymentId: existing.paymentId, otpRequired: true };
  }

  if (number === DECLINED_CARD) throw new ApiError(422, "card_declined", DECLINED_MESSAGE);
  if (number !== SUCCESS_CARD) throw new ApiError(422, "card_unsupported", UNSUPPORTED_MESSAGE);

  if (existing?.status === "pending") existing.status = "failed";
  const payment: Payment = {
    paymentId: newId("pay"),
    userId,
    idempotencyKey,
    fingerprint,
    address: shipping,
    deliveryOption: input.deliveryOption,
    last4: number.slice(-4),
    cartSignature: signature,
    attempts: 0,
    status: "pending",
    createdAt: Date.now(),
  };
  s.payments.set(payment.paymentId, payment);
  s.byKey.set(keyId, payment.paymentId);
  return { paymentId: payment.paymentId, otpRequired: true };
}

export type VerifyResult = { orderId: string; orderNumber: string };

/** Verifies the OTP and, on success, places the order exactly once. */
export async function verifyOtp(userId: string, paymentId: string, otp: string): Promise<VerifyResult> {
  const s = store();
  const payment = s.payments.get(paymentId);
  if (!payment || payment.userId !== userId) throw new ApiError(404, "not_found", "Payment not found.");

  if (payment.status === "succeeded" && payment.orderId) return orderRef(payment.orderId);
  if (payment.status === "failed") {
    throw new ApiError(409, "payment_failed", "This payment is no longer valid. Please re-enter your card details.");
  }

  if (otp.trim() !== OTP_CODE) {
    payment.attempts += 1;
    if (payment.attempts >= (KB.b11 ? 5 : MAX_OTP_ATTEMPTS)) {
      payment.status = "failed";
      throw new ApiError(422, "otp_failed", "Too many incorrect OTP attempts. Your payment failed. Please try again.", undefined, {
        attemptsLeft: 0,
      });
    }
    throw new ApiError(422, "otp_incorrect", "Incorrect OTP", undefined, { attemptsLeft: Math.max(0, MAX_OTP_ATTEMPTS - payment.attempts) });
  }

  const order = await mutate((db) => {
    if (payment.status === "succeeded" && payment.orderId) {
      return db.orders.find((o) => o.id === payment.orderId)!;
    }
    if (payment.status !== "pending") {
      throw new ApiError(409, "payment_failed", "This payment is no longer valid. Please re-enter your card details.");
    }
    try {
      const placed = placeOrder(db, {
        userId,
        shippingAddress: payment.address,
        deliveryOption: payment.deliveryOption,
        last4: payment.last4,
        expectedCartSignature: payment.cartSignature,
      });
      payment.status = "succeeded";
      payment.orderId = placed.id;
      return placed;
    } catch (err) {
      payment.status = "failed";
      throw err;
    }
  });
  return { orderId: order.id, orderNumber: order.orderNumber };
}

async function orderRef(orderId: string): Promise<VerifyResult> {
  const order = await readLocked((db) => db.orders.find((o) => o.id === orderId));
  if (!order) throw new ApiError(404, "not_found", "Order not found.");
  return { orderId: order.id, orderNumber: order.orderNumber };
}
