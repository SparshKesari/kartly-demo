import { test, expect } from "./fixtures";
import { resultSlugs, settle, withFilters } from "./helpers";
import { expectedSlugs, nth } from "./seed-oracle";

test.describe("flow 2: out-of-stock visibility", () => {
  test("2nd laptop is hidden until 'Include out of stock'; PDP blocks purchase", async ({ page }) => {
    const oos = nth("laptops", 2);
    expect(oos.stock).toBe(0);

    await page.goto("/c/laptops");
    await settle(page);
    const visible = expectedSlugs({ category: "laptops" });
    await expect(page.getByTestId("results-count")).toHaveText(`1-${visible.length} of ${visible.length} results`);
    await expect(page.getByTestId(`product-card-${oos.slug}`)).toHaveCount(0);

    await withFilters(page, async () => {
      await page.getByTestId("filter-include-out-of-stock").click();
      await expect(page).toHaveURL(/includeOutOfStock=1/);
      await expect(page.getByTestId("filter-include-out-of-stock")).toBeChecked();
    });
    const withOos = expectedSlugs({ category: "laptops", includeOutOfStock: true });
    await expect(page.getByTestId("results-count")).toHaveText(`1-${withOos.length} of ${withOos.length} results`);
    expect(await resultSlugs(page)).toEqual(withOos);
    const card = page.getByTestId(`product-card-${oos.slug}`);
    await expect(card.getByTestId("out-of-stock-badge")).toBeVisible();
    await expect(page.getByTestId(`add-to-cart-${oos.slug}`)).toBeDisabled();

    // low stock badge on the 3rd laptop (stock 3)
    const low = nth("laptops", 3);
    await expect(page.getByTestId(`product-card-${low.slug}`).getByTestId("low-stock-badge")).toHaveText("Only 3 left");

    await card.getByTestId("product-card-title").click();
    await expect(page).toHaveURL(new RegExp(`/p/${oos.slug}$`));
    await expect(page.getByTestId("pdp-stock-status")).toHaveText("Out of stock");
    await expect(page.getByTestId("add-to-cart-btn")).toBeDisabled();
    await expect(page.getByTestId("buy-now-btn")).toBeDisabled();
  });
});
