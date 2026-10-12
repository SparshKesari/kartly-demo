import { test, expect } from "./fixtures";
import { resultSlugs, search, settle, withFilters } from "./helpers";
import { expectedSlugs } from "./seed-oracle";

test.describe("flow 1: search, filter, sort", () => {
  test("search phone, filter, sort, refresh keeps state, clear all", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await search(page, "phone");

    const all = expectedSlugs({ q: "phone" });
    expect(all.length).toBeGreaterThan(0);
    await expect(page.getByTestId("results-count")).toHaveText(`1-${all.length} of ${all.length} results`);
    expect(await resultSlugs(page)).toEqual(all);

    // brand filter (OR within brands)
    await withFilters(page, async () => {
      await page.getByTestId("filter-brand-apple").click();
      await expect(page).toHaveURL(/brand=apple/);
      await expect(page.getByTestId("filter-brand-apple")).toBeChecked();
    });
    const apple = expectedSlugs({ q: "phone", brands: ["apple"] });
    await expect(page.getByTestId("results-count")).toHaveText(`1-${apple.length} of ${apple.length} results`);

    // sort price low to high
    await page.getByTestId("sort-select").selectOption("price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);
    const appleSorted = expectedSlugs({ q: "phone", brands: ["apple"], sort: "price-asc" });
    await expect.poll(() => resultSlugs(page)).toEqual(appleSorted);
    const prices = await page.locator('ul[aria-label="Search results"] [data-testid="product-card-price"]').allTextContents();
    const values = prices.map((p) => Number(p.replace(/[^0-9.]/g, "")));
    expect([...values].sort((a, b) => a - b)).toEqual(values);

    // 4 stars & up, then $100 to $200: groups combine with AND
    await withFilters(page, async () => {
      await page.getByTestId("filter-rating-4").click();
      await expect(page).toHaveURL(/rating=4/);
    });
    const rated = expectedSlugs({ q: "phone", brands: ["apple"], rating: 4, sort: "price-asc" });
    await expect.poll(() => resultSlugs(page)).toEqual(rated);

    await withFilters(page, async () => {
      await page.getByTestId("filter-price-100-200").click();
      await expect(page).toHaveURL(/minPrice=100&maxPrice=200/);
    });
    const full = expectedSlugs({ q: "phone", brands: ["apple"], rating: 4, min: 100, max: 200, sort: "price-asc" });
    if (full.length === 0) {
      await expect(page.getByTestId("empty-results")).toHaveText(/No results for 'phone'/);
    } else {
      await expect.poll(() => resultSlugs(page)).toEqual(full);
    }
    await expect(page.getByTestId("filter-chip-brand")).toBeVisible();
    await expect(page.getByTestId("filter-chip-rating")).toBeVisible();
    await expect(page.getByTestId("filter-chip-price")).toBeVisible();

    // refresh keeps identical state
    const url = page.url();
    const countBefore = await page.getByTestId("results-count").textContent();
    await page.reload();
    await settle(page);
    expect(page.url()).toBe(url);
    await expect(page.getByTestId("results-count")).toHaveText(countBefore ?? "");
    await expect(page.getByTestId("sort-select")).toHaveValue("price-asc");
    await withFilters(page, async () => {
      await expect(page.getByTestId("filter-brand-apple")).toBeChecked();
      await expect(page.getByTestId("filter-rating-4")).toBeChecked();
      await expect(page.getByTestId("filter-price-100-200")).toBeChecked();
    });

    // removing one chip relaxes that group only
    await page.getByTestId("filter-chip-price").click();
    await expect(page).not.toHaveURL(/minPrice/);
    await expect.poll(() => resultSlugs(page)).toEqual(rated);

    // clear all
    await page.getByTestId("clear-filters").click();
    await expect(page).not.toHaveURL(/brand=|rating=/);
    await expect(page.getByTestId("results-count")).toHaveText(`1-${all.length} of ${all.length} results`);
    await expect(page.getByTestId("clear-filters")).toHaveCount(0);
  });

  test("full catalog paginates 24 per page and shows the empty state", async ({ page }) => {
    await page.goto("/search?q=");
    const all = expectedSlugs({});
    await expect(page.getByTestId("results-count")).toHaveText(`1-24 of ${all.length} results`);
    expect(await resultSlugs(page)).toEqual(all.slice(0, 24));
    await expect(page.getByTestId("pagination-prev")).toBeDisabled();
    await page.getByTestId("pagination-next").click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("results-count")).toHaveText(`25-48 of ${all.length} results`);
    await expect.poll(() => resultSlugs(page)).toEqual(all.slice(24, 48));
    await page.getByTestId("pagination-page-4").click();
    await expect(page.getByTestId("results-count")).toHaveText(`73-${all.length} of ${all.length} results`);
    await expect(page.getByTestId("pagination-next")).toBeDisabled();

    await search(page, "zzzz nothing");
    await expect(page.getByTestId("empty-results")).toHaveText(/No results for 'zzzz nothing'/);
  });

  test("custom price range and category scope", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.getByTestId("search-category-select").selectOption("laptops");
    await page.getByTestId("search-input").fill("");
    await page.getByTestId("search-submit").click();
    await expect(page).toHaveURL(/category=laptops/);
    const laptops = expectedSlugs({ category: "laptops" });
    await expect(page.getByTestId("results-count")).toHaveText(`1-${laptops.length} of ${laptops.length} results`);

    await page.goto("/search?q=");
    await settle(page);
    await withFilters(page, async () => {
      await page.getByTestId("filter-price-min").fill("20");
      await page.getByTestId("filter-price-max").fill("30");
      await page.getByTestId("filter-price-apply").click();
      await expect(page).toHaveURL(/minPrice=20&maxPrice=30/);
    });
    const ranged = expectedSlugs({ min: 20, max: 30 });
    await expect(page.getByTestId("results-count")).toHaveText(`1-${ranged.length} of ${ranged.length} results`);
    const prices = (await page.locator('[data-testid="product-card-price"]').allTextContents()).map((p) => Number(p.replace(/[^0-9.]/g, "")));
    expect(prices.every((p) => p >= 20 && p < 30)).toBeTruthy();
  });
});
