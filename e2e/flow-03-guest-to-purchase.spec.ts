import { test, expect } from "./fixtures";
import { SUCCESS_CARD, addToCartFromPdp, fillCard, ordersOf, submitOtp } from "./checkout-helpers";
import { productBySlug, settle } from "./helpers";
import { $, expectedTotals, nth } from "./seed-oracle";

test.describe("flow 3: guest to purchase", () => {
  test("guest cart -> login as bob (merge) -> standard -> 4242 + OTP -> confirmation", async ({ page }) => {
    const phone = nth("smartphones", 1);
    const mascara = nth("beauty", 1);
    const phoneStock = (await productBySlug(page.request, phone.slug)).stock;
    const mascaraStock = (await productBySlug(page.request, mascara.slug)).stock;

    await addToCartFromPdp(page, phone.slug, ["variant-color-silver", "variant-storage-128gb"]);
    await page.goto("/c/beauty");
    await page.getByTestId(`add-to-cart-${mascara.slug}`).click();
    await expect(page.getByTestId("cart-count")).toHaveText("2");

    await page.getByTestId("cart-link").click();
    await expect(page.getByTestId(`cart-item-${phone.id}-silver-128gb`)).toBeVisible();
    await settle(page);
    await page.getByTestId("checkout-btn").click();
    await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);

    await page.getByTestId("login-email").fill("bob@kartly.test");
    await page.getByTestId("login-password").fill("Password@123");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("toast")).toContainText("2 items from your guest cart were merged");
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId("cart-count")).toHaveText("2");

    await expect(page.getByTestId("address-option-a_bob_home")).toBeChecked();
    await page.getByTestId("address-continue").click();
    await expect(page.getByTestId("delivery-standard")).toBeChecked();
    await page.getByTestId("delivery-standard").click();
    await page.getByTestId("delivery-continue").click();
    await fillCard(page, SUCCESS_CARD);
    await page.getByTestId("payment-continue").click();

    const expected = expectedTotals(phone.price + mascara.price, null, "standard");
    await expect(page.getByTestId("review-total")).toHaveText($(expected.total));
    await page.getByTestId("place-order-btn").click();
    await expect(page.getByTestId("otp-dialog")).toBeVisible();
    await submitOtp(page, "123456");

    await expect(page).toHaveURL(/\/order\/[^/]+\/confirmation$/);
    await expect(page.getByTestId("order-confirmation")).toBeVisible();
    const orderNumber = (await page.getByTestId("order-number").textContent())!.trim();
    expect(orderNumber).toMatch(/^KRT-\d{6}$/);
    await expect(page.getByTestId("order-total")).toHaveText($(expected.total));
    await expect(page.getByTestId("order-address")).toContainText("350 Fifth Avenue");
    await expect(page.getByTestId("order-delivery-estimate")).toContainText("Estimated delivery");
    await expect(page.getByTestId("cart-count")).toHaveText("0");

    await page.goto("/account/orders");
    await expect(page.getByTestId(`order-row-${orderNumber}`)).toBeVisible();
    await expect(page.getByTestId(`order-row-${orderNumber}`)).toContainText("Placed");

    expect((await productBySlug(page.request, phone.slug)).stock).toBe(phoneStock - 1);
    expect((await productBySlug(page.request, mascara.slug)).stock).toBe(mascaraStock - 1);

    await page.goto("/cart");
    await expect(page.getByTestId("empty-cart")).toBeVisible();
    const orders = await ordersOf(page.request);
    expect(orders.total).toBe(1);
  });
});
