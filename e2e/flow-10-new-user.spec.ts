import { test, expect } from "./fixtures";
import { SUCCESS_CARD, fillCard, ordersOf, submitOtp } from "./checkout-helpers";
import { settle } from "./helpers";
import { nth } from "./seed-oracle";

test.describe("flow 10: new user with no address", () => {
  test("register, add to cart, checkout forces the address form, order placed", async ({ page }) => {
    const email = `newbie.${Date.now()}@kartly.test`;
    await page.goto("/register");
    await page.getByTestId("register-name").fill("Nina Newbie");
    await page.getByTestId("register-email").fill(email);
    await page.getByTestId("register-password").fill("Secret123");
    await page.getByTestId("register-confirm").fill("Secret123");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("account-menu")).toContainText("Hello, Nina Newbie");

    const p = nth("home-decoration", 2);
    await page.goto(`/p/${p.slug}`);
    await settle(page);
    await page.getByTestId("add-to-cart-btn").click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/cart");
    await settle(page);
    await page.getByTestId("checkout-btn").click();
    await expect(page).toHaveURL(/\/checkout$/);

    await expect(page.getByTestId("address-fullname")).toBeVisible();
    await expect(page.locator('[data-testid^="address-option-"]')).toHaveCount(0);
    await expect(page.getByTestId("address-continue")).toHaveCount(0);

    // validation: phone and zip formats
    await page.getByTestId("address-fullname").fill("Nina Newbie");
    await page.getByTestId("address-phone").fill("12345");
    await page.getByTestId("address-line1").fill("1 Infinite Loop");
    await page.getByTestId("address-city").fill("Cupertino");
    await page.getByTestId("address-state").fill("CA");
    await page.getByTestId("address-zip").fill("9501");
    await page.getByTestId("address-country").fill("United States");
    await page.getByTestId("address-save-btn").click();
    await expect(page.getByText("Phone must be 10 digits.")).toBeVisible();
    await expect(page.getByText("ZIP must be 5 digits.")).toBeVisible();

    await page.getByTestId("address-phone").fill("4085550199");
    await page.getByTestId("address-zip").fill("95014");
    await page.getByTestId("address-save-btn").click();
    await expect(page.locator('[data-testid^="address-option-"]')).toHaveCount(1);
    await page.getByTestId("address-continue").click();
    await page.getByTestId("delivery-continue").click();
    await fillCard(page, SUCCESS_CARD);
    await page.getByTestId("payment-continue").click();
    await page.getByTestId("place-order-btn").click();
    await submitOtp(page, "123456");
    await expect(page.getByTestId("order-confirmation")).toBeVisible();
    await expect(page.getByTestId("order-address")).toContainText("1 Infinite Loop");
    expect((await ordersOf(page.request)).total).toBe(1);
  });
});
