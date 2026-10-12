import { test, expect } from "./fixtures";
import { login } from "./helpers";
import { nth } from "./seed-oracle";

test.describe("flow 8: stock conflict", () => {
  test("carol's cart warns on both lines and blocks checkout until fixed", async ({ page }) => {
    await login(page, "carol@kartly.test");
    await page.goto("/cart");
    const oos = nth("laptops", 2);
    const low = nth("beauty", 3);
    await expect(page.getByTestId(`cart-item-warning-${oos.id}`)).toBeVisible();
    await expect(page.getByTestId(`cart-item-warning-${low.id}`)).toContainText("Only 3 left");
    await expect(page.getByTestId("checkout-btn")).toBeDisabled();
    await expect(page.getByTestId(`qty-increase-${low.id}`)).toBeDisabled();

    await page.getByTestId(`remove-item-${oos.id}`).click();
    await expect(page.getByTestId(`cart-item-${oos.id}`)).toHaveCount(0);
    await expect(page.getByTestId("checkout-btn")).toBeDisabled();

    await page.getByTestId(`qty-decrease-${low.id}`).click();
    await expect(page.getByTestId(`cart-item-qty-${low.id}`)).toHaveText("4");
    await expect(page.getByTestId("checkout-btn")).toBeDisabled();
    await page.getByTestId(`qty-decrease-${low.id}`).click();
    await expect(page.getByTestId(`cart-item-qty-${low.id}`)).toHaveText("3");
    await expect(page.getByTestId(`cart-item-warning-${low.id}`)).toHaveCount(0);
    await expect(page.getByTestId("checkout-btn")).toBeEnabled();
    await expect(page.getByTestId("cart-count")).toHaveText("3");

    await page.getByTestId("checkout-btn").click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId("checkout-step-address")).toBeVisible();
  });

  test("checkout page refuses a cart with stock problems", async ({ page }) => {
    await login(page, "carol@kartly.test");
    await page.goto("/checkout");
    await expect(page.getByTestId("checkout-blocked")).toBeVisible();
    await expect(page.getByTestId("place-order-btn")).toHaveCount(0);
  });
});
