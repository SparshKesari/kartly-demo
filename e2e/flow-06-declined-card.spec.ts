import { test, expect } from "./fixtures";
import { DECLINED_CARD, SUCCESS_CARD, addToCartFromPdp, fillCard, goToReview, ordersOf, submitOtp } from "./checkout-helpers";
import { login } from "./helpers";
import { nth } from "./seed-oracle";

test.describe("flow 6: declined card", () => {
  test("declined card keeps the cart, retry with 4242 creates exactly one order", async ({ page }) => {
    await login(page, "bob@kartly.test");
    const p = nth("sunglasses", 1);
    await addToCartFromPdp(page, p.slug);
    await page.goto("/checkout");
    await goToReview(page, { card: DECLINED_CARD });

    await page.getByTestId("place-order-btn").click();
    await expect(page.getByTestId("payment-error")).toHaveText("Your card was declined.");
    await expect(page.getByTestId("otp-dialog")).toHaveCount(0);
    await expect(page.getByTestId("card-number")).toBeVisible();

    expect((await ordersOf(page.request)).total).toBe(0);
    const cart = (await (await page.request.get("/api/cart")).json()).data;
    expect(cart.count).toBe(1);
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await fillCard(page, SUCCESS_CARD);
    await page.getByTestId("payment-continue").click();
    await page.getByTestId("place-order-btn").click();
    await expect(page.getByTestId("otp-dialog")).toBeVisible();
    await submitOtp(page, "123456");
    await expect(page.getByTestId("order-confirmation")).toBeVisible();
    expect((await ordersOf(page.request)).total).toBe(1);
  });

  test("other valid cards are not supported in test mode", async ({ page }) => {
    await login(page, "bob@kartly.test");
    await addToCartFromPdp(page, nth("sunglasses", 1).slug);
    await page.goto("/checkout");
    await goToReview(page, { card: "5555 5555 5555 4444" });
    await page.getByTestId("place-order-btn").click();
    await expect(page.getByTestId("payment-error")).toHaveText("This card is not supported in test mode.");
  });

  test("client-side card validation (Luhn, expiry, CVV)", async ({ page }) => {
    await login(page, "bob@kartly.test");
    await addToCartFromPdp(page, nth("sunglasses", 1).slug);
    await page.goto("/checkout");
    await page.getByTestId("address-continue").click();
    await page.getByTestId("delivery-continue").click();
    await page.getByTestId("card-number").fill("4242 4242 4242 4241");
    await page.getByTestId("card-name").fill("Test Shopper");
    await page.getByTestId("card-expiry").fill("01/20");
    await page.getByTestId("card-cvv").fill("12");
    await page.getByTestId("payment-continue").click();
    await expect(page.getByText("Enter a valid card number.")).toBeVisible();
    await expect(page.getByText("This card has expired.")).toBeVisible();
    await expect(page.getByText("CVV must be 3 digits.")).toBeVisible();
    await expect(page.getByTestId("place-order-btn")).toHaveCount(0);
  });
});
