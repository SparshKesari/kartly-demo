import { test, expect } from "./fixtures";
import { addToCartFromPdp, goToReview, ordersOf, submitOtp } from "./checkout-helpers";
import { login } from "./helpers";
import { nth } from "./seed-oracle";

test.describe("flow 7: OTP failure", () => {
  test("3 wrong OTPs fail the payment; a fresh attempt with the right OTP works", async ({ page }) => {
    await login(page, "bob@kartly.test");
    await addToCartFromPdp(page, nth("womens-bags", 1).slug);
    await page.goto("/checkout");
    await goToReview(page);

    await page.getByTestId("place-order-btn").click();
    await expect(page.getByTestId("otp-dialog")).toBeVisible();
    await submitOtp(page, "111111");
    await expect(page.getByTestId("otp-error")).toContainText("Incorrect OTP");
    await submitOtp(page, "222222");
    await expect(page.getByTestId("otp-error")).toContainText("Incorrect OTP");
    await expect(page.getByTestId("otp-error")).toContainText("1 attempt left");
    await submitOtp(page, "333333");

    await expect(page.getByTestId("otp-dialog")).toHaveCount(0);
    await expect(page.getByTestId("card-number")).toBeVisible();
    await expect(page.getByTestId("payment-error")).toContainText("payment failed");
    expect((await ordersOf(page.request)).total).toBe(0);
    expect((await (await page.request.get("/api/cart")).json()).data.count).toBe(1);

    await page.getByTestId("payment-continue").click();
    await page.getByTestId("place-order-btn").click();
    await expect(page.getByTestId("otp-dialog")).toBeVisible();
    await expect(page.getByTestId("otp-error")).toHaveCount(0);
    await submitOtp(page, "123456");
    await expect(page.getByTestId("order-confirmation")).toBeVisible();
    expect((await ordersOf(page.request)).total).toBe(1);
  });

  test("OTP dialog: Esc closes it and returns focus to Place order", async ({ page }) => {
    await login(page, "bob@kartly.test");
    await addToCartFromPdp(page, nth("womens-bags", 1).slug);
    await page.goto("/checkout");
    await goToReview(page);
    await page.getByTestId("place-order-btn").click();
    await expect(page.getByTestId("otp-input")).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // focus stays inside the dialog
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="otp-dialog"]')))).toBeTruthy();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("otp-dialog")).toHaveCount(0);
    await expect(page.getByTestId("place-order-btn")).toBeFocused();

    await page.getByTestId("place-order-btn").click();
    await page.getByTestId("otp-cancel").click();
    await expect(page.getByTestId("otp-dialog")).toHaveCount(0);
    await expect(page.getByTestId("place-order-btn")).toBeFocused();
  });
});
