import { test, expect } from "./fixtures";
import { login } from "./helpers";

test.describe("phase 7: orders", () => {
  test("erin's history paginates 10 per page, newest first, and filters by status", async ({ page }) => {
    await login(page, "erin@kartly.test");
    await page.goto("/account/orders");
    const rows = page.locator('[data-testid^="order-row-KRT-"]');
    await expect(rows).toHaveCount(10);
    await expect(page.getByTestId("orders-count")).toContainText("12 orders");
    const first = await rows.first().getAttribute("data-testid");
    expect(first).toBe("order-row-KRT-000016");
    await page.getByTestId("pagination-next").click();
    await expect(page).toHaveURL(/page=2/);
    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId("pagination-next")).toBeDisabled();
    await page.getByTestId("pagination-page-1").click();
    await expect(rows).toHaveCount(10);

    for (const status of ["placed", "shipped", "delivered", "cancelled"]) {
      await page.getByTestId("orders-status-filter").selectOption(status);
      await expect(page).toHaveURL(new RegExp(`status=${status}`));
      await expect(rows).toHaveCount(3);
      const labels = await page.getByTestId("order-row-status").allTextContents();
      expect(labels.every((l) => l.toLowerCase() === status)).toBeTruthy();
    }
  });

  test("another user's order is a 404 in the UI and the API", async ({ page, allowConsole }) => {
    allowConsole(/status of 404/);
    await login(page, "bob@kartly.test");
    for (const id of ["o_seed_0004", "KRT-000004"]) {
      const res = await page.goto(`/account/orders/${id}`);
      expect(res?.status()).toBe(404);
      await expect(page.getByTestId("not-found")).toBeVisible();
      expect((await page.request.get(`/api/orders/${id}`)).status()).toBe(404);
      expect((await page.request.post(`/api/orders/${id}/cancel`)).status()).toBe(404);
      expect((await page.request.post(`/api/orders/${id}/buy-again`)).status()).toBe(404);
    }
    const res = await page.goto("/order/o_seed_0004/confirmation");
    expect(res?.status()).toBe(404);
  });

  test("order detail shows timeline, items, totals and address; buy it again fills the cart", async ({ page }) => {
    await login(page, "alice@kartly.test");
    await page.goto("/account/orders");
    await page.getByTestId("order-row-KRT-000001").getByRole("link", { name: "View order details" }).click();
    await expect(page.getByTestId("order-detail")).toBeVisible();
    await expect(page.getByTestId("order-status")).toHaveText("Delivered");
    await expect(page.getByTestId("timeline-entry")).toHaveCount(3);
    await expect(page.getByTestId("order-address")).toContainText("742 Evergreen Terrace");
    const api = (await (await page.request.get("/api/orders/KRT-000001")).json()).data;
    await expect(page.getByTestId("order-total")).toHaveText(`$${api.total.toFixed(2)}`);

    await expect(page.getByTestId("cart-count")).toHaveText("4");
    await page.getByTestId("buy-again-btn").click();
    await expect(page).toHaveURL(/\/cart$/);
    const units = api.items.reduce((n: number, i: { quantity: number }) => n + i.quantity, 0);
    await expect(page.getByTestId("cart-count")).toHaveText(String(4 + units));
    await expect(page.getByTestId("toast")).toContainText("Added");
  });
});
