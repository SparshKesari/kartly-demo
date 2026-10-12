import { test, expect } from "./fixtures";
import { addToCartFromPdp, goToReview, ordersOf } from "./checkout-helpers";
import { login } from "./helpers";
import { nth } from "./seed-oracle";

test.describe("flow 9: double submit", () => {
  test("double-clicking Place order and OTP submit creates one order", async ({ page }) => {
    await login(page, "bob@kartly.test");
    await addToCartFromPdp(page, nth("sunglasses", 3).slug);
    await page.goto("/checkout");
    await goToReview(page);

    await page.getByTestId("place-order-btn").dblclick();
    await expect(page.getByTestId("otp-dialog")).toHaveCount(1);
    await page.getByTestId("otp-input").fill("123456");
    await page.getByTestId("otp-submit").dblclick();
    await expect(page.getByTestId("order-confirmation")).toBeVisible();
    expect((await ordersOf(page.request)).total).toBe(1);
  });

  test("API: same idempotency key and parallel OTP submits never create two orders", async ({ request }) => {
    await request.post("/api/auth/login", { data: { email: "bob@kartly.test", password: "Password@123" } });
    await request.post("/api/cart/items", { data: { productId: nth("sunglasses", 3).id, quantity: 1 } });
    const body = { cardNumber: "4242424242424242", nameOnCard: "Bob", expiry: "12/30", cvv: "123", deliveryOption: "standard", addressId: "a_bob_home" };
    const headers = { "Idempotency-Key": "test-key-0001" };
    const [a, b] = await Promise.all([
      request.post("/api/checkout/payment", { data: body, headers }),
      request.post("/api/checkout/payment", { data: body, headers }),
    ]);
    const pa = (await a.json()).data;
    const pb = (await b.json()).data;
    expect(pa.paymentId).toBe(pb.paymentId);
    expect(pa.otpRequired).toBe(true);

    const results = await Promise.all(
      [1, 2, 3].map(() => request.post("/api/checkout/verify-otp", { data: { paymentId: pa.paymentId, otp: "123456" } })),
    );
    const orderIds = await Promise.all(results.map(async (r) => (await r.json()).data.orderId));
    expect(new Set(orderIds).size).toBe(1);
    expect((await ordersOf(request)).total).toBe(1);

    // replaying the payment call with the same key returns the placed order, not a new payment
    const replay = (await (await request.post("/api/checkout/payment", { data: body, headers })).json()).data;
    expect(replay.orderId).toBe(orderIds[0]);
    expect((await ordersOf(request)).total).toBe(1);
  });
});

test.describe("flow 9b: changed details after cancelling OTP", () => {
  test("cancel OTP, change the address, place again: order ships to the new address", async ({ page }) => {
    await login(page, "alice@kartly.test");
    await page.goto("/cart");
    // remove the laptop so express would be possible and the cart is small
    await page.getByTestId("remove-item-p78").click();
    await expect(page.getByTestId("cart-item-p78")).toHaveCount(0);
    await page.goto("/checkout");
    await goToReview(page, { addressId: "a_alice_home" });
    await page.getByTestId("place-order-btn").click();
    await expect(page.getByTestId("otp-dialog")).toBeVisible();
    await page.getByTestId("otp-cancel").click();

    await page.getByTestId("review-edit-address").click();
    await page.getByTestId("address-option-a_alice_work").click();
    await page.getByTestId("address-continue").click();
    await page.getByTestId("delivery-continue").click();
    await page.getByTestId("payment-continue").click();
    await page.getByTestId("place-order-btn").click();
    await page.getByTestId("otp-input").fill("123456");
    await page.getByTestId("otp-submit").click();
    await expect(page.getByTestId("order-confirmation")).toBeVisible();
    await expect(page.getByTestId("order-address")).toContainText("1 Market Street");
    const orders = await ordersOf(page.request);
    expect(orders.total).toBe(5);
    expect(orders.orders[0].shippingAddress.line1).toBe("1 Market Street");
  });
});
