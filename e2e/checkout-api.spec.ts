import { request as pwRequest } from "@playwright/test";
import { test, expect } from "./fixtures";
import { ordersOf } from "./checkout-helpers";
import { nth } from "./seed-oracle";

const card = { cardNumber: "4242424242424242", nameOnCard: "Tester", expiry: "12/30", cvv: "123" };

test.describe("phase 6: checkout rules (API)", () => {
  test("two users buying the last unit at once: exactly one order succeeds", async ({ baseURL }) => {
    const last = nth("mobile-accessories", 4); // stock 1
    const a = await pwRequest.newContext({ baseURL });
    const b = await pwRequest.newContext({ baseURL });
    try {
      await a.post("/api/auth/login", { data: { email: "bob@kartly.test", password: "Password@123" } });
      await b.post("/api/auth/login", { data: { email: "erin@kartly.test", password: "Password@123" } });
      for (const ctx of [a, b]) {
        const add = await ctx.post("/api/cart/items", { data: { productId: last.id, quantity: 1 } });
        expect(add.status()).toBe(201);
      }
      const pa = (await (await a.post("/api/checkout/payment", { data: { ...card, deliveryOption: "standard", addressId: "a_bob_home" }, headers: { "Idempotency-Key": "race-a-0001" } })).json()).data;
      const pb = (await (await b.post("/api/checkout/payment", { data: { ...card, deliveryOption: "standard", addressId: "a_erin_home" }, headers: { "Idempotency-Key": "race-b-0001" } })).json()).data;
      const [ra, rb] = await Promise.all([
        a.post("/api/checkout/verify-otp", { data: { paymentId: pa.paymentId, otp: "123456" } }),
        b.post("/api/checkout/verify-otp", { data: { paymentId: pb.paymentId, otp: "123456" } }),
      ]);
      const statuses = [ra.status(), rb.status()].sort();
      expect(statuses).toEqual([201, 409]);
      const loser = ra.status() === 409 ? ra : rb;
      expect((await loser.json()).error.message).toBe("Only 0 left. Please update your cart.");
      const product = (await (await a.get(`/api/products/${last.slug}`)).json()).data.product;
      expect(product.stock).toBe(0);
      // the loser's cart is intact
      const loserCtx = loser === ra ? a : b;
      expect((await (await loserCtx.get("/api/cart")).json()).data.count).toBe(1);
    } finally {
      await a.dispose();
      await b.dispose();
    }
  });

  test("changing the address after cancelling OTP starts a new payment that ships to the new address", async ({ request }) => {
    await request.post("/api/auth/login", { data: { email: "alice@kartly.test", password: "Password@123" } });
    const headers = { "Idempotency-Key": "alice-change-0001" };
    const first = (await (await request.post("/api/checkout/payment", { data: { ...card, deliveryOption: "standard", addressId: "a_alice_home" }, headers })).json()).data;
    const again = (await (await request.post("/api/checkout/payment", { data: { ...card, deliveryOption: "standard", addressId: "a_alice_home" }, headers })).json()).data;
    expect(again.paymentId).toBe(first.paymentId);
    const second = (await (await request.post("/api/checkout/payment", { data: { ...card, deliveryOption: "standard", addressId: "a_alice_work" }, headers })).json()).data;
    expect(second.paymentId).not.toBe(first.paymentId);
    // the superseded payment can no longer be completed
    const stale = await request.post("/api/checkout/verify-otp", { data: { paymentId: first.paymentId, otp: "123456" } });
    expect(stale.status()).toBe(409);
    const done = await request.post("/api/checkout/verify-otp", { data: { paymentId: second.paymentId, otp: "123456" } });
    expect(done.status()).toBe(201);
    const order = (await (await request.get(`/api/orders/${(await done.json()).data.orderId}`)).json()).data;
    expect(order.shippingAddress.line1).toBe("1 Market Street");
    expect(order.deliveryOption).toBe("standard");
  });

  test("express is rejected when an item lacks fast delivery; validation and auth errors", async ({ request }) => {
    expect((await request.post("/api/checkout/quote", { data: { addressId: "x", deliveryOption: "standard" } })).status()).toBe(401);
    await request.post("/api/auth/login", { data: { email: "alice@kartly.test", password: "Password@123" } });
    // alice's cart contains the 1st laptop (id 78, divisible by 3 -> no fast delivery)
    const quote = await request.post("/api/checkout/quote", { data: { addressId: "a_alice_home", deliveryOption: "express" } });
    expect(quote.status()).toBe(422);
    const noKey = await request.post("/api/checkout/payment", { data: { ...card, deliveryOption: "standard", addressId: "a_alice_home" } });
    expect(noKey.status()).toBe(400);
    const badCard = await request.post("/api/checkout/payment", {
      data: { ...card, cardNumber: "4242424242424241", expiry: "01/20", cvv: "1", deliveryOption: "standard", addressId: "a_alice_home" },
      headers: { "Idempotency-Key": "bad-card-0001" },
    });
    expect(badCard.status()).toBe(400);
    const fields = (await badCard.json()).error.fields;
    expect(Object.keys(fields).sort()).toEqual(["cardNumber", "cvv", "expiry"]);
    const declined = await request.post("/api/checkout/payment", {
      data: { ...card, cardNumber: "4000000000000002", deliveryOption: "standard", addressId: "a_alice_home" },
      headers: { "Idempotency-Key": "declined-0001" },
    });
    expect(declined.status()).toBe(422);
    expect((await declined.json()).error.message).toBe("Your card was declined.");
    const otherAddress = await request.post("/api/checkout/payment", {
      data: { ...card, deliveryOption: "standard", addressId: "a_bob_home" },
      headers: { "Idempotency-Key": "other-addr-0001" },
    });
    expect(otherAddress.status()).toBe(404);
    expect((await ordersOf(request)).total).toBe(4);
  });

  test("wrong OTP three times fails the payment", async ({ request }) => {
    await request.post("/api/auth/login", { data: { email: "alice@kartly.test", password: "Password@123" } });
    const pay = (await (await request.post("/api/checkout/payment", { data: { ...card, deliveryOption: "standard", addressId: "a_alice_home" }, headers: { "Idempotency-Key": "otp-0001" } })).json()).data;
    for (let i = 0; i < 2; i++) {
      const r = await request.post("/api/checkout/verify-otp", { data: { paymentId: pay.paymentId, otp: "000000" } });
      expect(r.status()).toBe(422);
      expect((await r.json()).error.message).toBe("Incorrect OTP");
    }
    const third = await request.post("/api/checkout/verify-otp", { data: { paymentId: pay.paymentId, otp: "000000" } });
    expect((await third.json()).error.code).toBe("otp_failed");
    const after = await request.post("/api/checkout/verify-otp", { data: { paymentId: pay.paymentId, otp: "123456" } });
    expect(after.status()).toBe(409);
    expect((await ordersOf(request)).total).toBe(4);
  });
});
