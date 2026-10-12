import { test, expect } from "./fixtures";
import { login, productBySlug } from "./helpers";
import { nth } from "./seed-oracle";

test.describe("flow 11: cancel", () => {
  test("cancel alice's placed order: status cancelled, stock restored, button gone", async ({ page }) => {
    await login(page, "alice@kartly.test");
    const echo = nth("mobile-accessories", 1);
    const before = (await productBySlug(page.request, echo.slug)).stock;

    await page.goto("/account/orders?status=placed");
    await expect(page.locator('[data-testid^="order-row-KRT-"]')).toHaveCount(1);
    await page.getByTestId("order-row-KRT-000004").getByRole("link", { name: "View order details" }).click();
    await expect(page.getByTestId("order-detail")).toBeVisible();
    await expect(page.getByTestId("order-status")).toHaveText("Placed");
    await expect(page.getByTestId("timeline-entry")).toHaveCount(1);

    await page.getByTestId("cancel-order-btn").click();
    await expect(page.getByTestId("order-status")).toHaveText("Cancelled");
    await expect(page.getByTestId("cancel-order-btn")).toHaveCount(0);
    await expect(page.getByTestId("timeline-entry")).toHaveCount(2);
    await expect(page.getByTestId("timeline-entry").last()).toContainText("Cancelled");
    expect((await productBySlug(page.request, echo.slug)).stock).toBe(before + 1);

    // cancelling again is rejected
    const again = await page.request.post("/api/orders/o_seed_0004/cancel");
    expect(again.status()).toBe(409);
    // shipped orders cannot be cancelled
    await page.goto("/account/orders/KRT-000002");
    await expect(page.getByTestId("order-status")).toHaveText("Shipped");
    await expect(page.getByTestId("cancel-order-btn")).toHaveCount(0);
  });
});
