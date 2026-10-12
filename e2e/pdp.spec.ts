import { test, expect } from "./fixtures";
import { settle } from "./helpers";
import { nth } from "./seed-oracle";

test.describe("phase 4: product detail page", () => {
  test("variants gate Add to Cart; quantity capped by stock; cart count updates", async ({ page }) => {
    const phone = nth("smartphones", 1);
    await page.goto(`/p/${phone.slug}`);
    await settle(page);
    await expect(page.getByTestId("pdp-title")).toHaveText(phone.title);
    await expect(page.getByTestId("pdp-brand")).toHaveText(phone.brand);
    await expect(page.getByTestId("pdp-price")).toHaveText(`$${phone.price.toFixed(2)}`);
    await expect(page.getByTestId("pdp-mrp")).toHaveText(`$${phone.mrp.toFixed(2)}`);
    await expect(page.getByTestId("pdp-discount")).toHaveText(`-${Math.round(((phone.mrp - phone.price) / phone.mrp) * 100)}%`);
    await expect(page.getByTestId("pdp-rating")).toContainText(String(phone.rating));
    await expect(page.getByTestId("pdp-stock-status")).toHaveText("In stock");
    await expect(page.getByTestId("pdp-delivery-estimate")).toContainText("delivery");

    await expect(page.getByTestId("add-to-cart-btn")).toBeDisabled();
    await page.getByTestId("variant-color-silver").click();
    await expect(page.getByTestId("add-to-cart-btn")).toBeDisabled();
    await page.getByTestId("variant-storage-256gb").click();
    await expect(page.getByTestId("add-to-cart-btn")).toBeEnabled();
    await expect(page.getByTestId("qty-select").locator("option")).toHaveCount(Math.min(phone.stock, 10));
    await page.getByTestId("qty-select").selectOption("2");
    await page.getByTestId("add-to-cart-btn").click();
    await expect(page.getByTestId("toast")).toContainText("Added 2");
    await expect(page.getByTestId("cart-count")).toHaveText("2");

    await page.goto("/cart");
    await expect(page.getByTestId(`cart-item-${phone.id}-silver-256gb`)).toBeVisible();
    await expect(page.getByTestId(`cart-item-qty-${phone.id}-silver-256gb`)).toHaveText("2");
  });

  test("low stock product caps quantity, gallery thumbnails switch the main image", async ({ page }) => {
    const low = nth("laptops", 3);
    await page.goto(`/p/${low.slug}`);
    await settle(page);
    await expect(page.getByTestId("pdp-stock-status")).toHaveText("Only 3 left in stock - order soon.");
    await expect(page.getByTestId("qty-select").locator("option")).toHaveCount(3);

    const main = page.getByTestId("pdp-image-main");
    const first = await main.getAttribute("src");
    await page.getByTestId("pdp-thumb-1").click();
    await expect(main).not.toHaveAttribute("src", first ?? "");
    await page.getByTestId("pdp-thumb-0").click();
    await expect(main).toHaveAttribute("src", first ?? "");

    await expect(page.getByTestId("review-item")).toHaveCount(3);
    const related = page.getByTestId("related-products").locator('article[data-testid^="product-card-"]');
    await expect(related).toHaveCount(3);
    await expect(page.getByTestId("related-products").getByTestId(`product-card-${low.slug}`)).toHaveCount(0);
  });

  test("Buy Now as a guest goes to login then checkout", async ({ page }) => {
    const p = nth("beauty", 1);
    await page.goto(`/p/${p.slug}`);
    await settle(page);
    await page.getByTestId("buy-now-btn").click();
    await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });

  test("wishlist button sends guests to login, toggles for users", async ({ page }) => {
    const p = nth("fragrances", 3);
    await page.goto(`/p/${p.slug}`);
    await settle(page);
    await page.getByTestId("wishlist-btn").click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fp%2F${p.slug}`));
    await page.getByTestId("login-email").fill("bob@kartly.test");
    await page.getByTestId("login-password").fill("Password@123");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(new RegExp(`/p/${p.slug}$`));
    await settle(page);
    await page.getByTestId("wishlist-btn").click();
    await expect(page.getByTestId("wishlist-btn")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("toast")).toContainText("wishlist");
    await page.goto("/account/wishlist");
    await expect(page.getByTestId(`wishlist-item-${p.id}`)).toBeVisible();
  });

  test("unknown product shows the friendly 404 page", async ({ page, allowConsole }) => {
    allowConsole(/status of 404/);
    const res = await page.goto("/p/no-such-product-999");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("not-found")).toBeVisible();
    await expect(page.getByTestId("header-logo")).toBeVisible();
  });
});
