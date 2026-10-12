import { test, expect } from "./fixtures";
import { login, openNav } from "./helpers";
import { nth } from "./seed-oracle";

test.describe("flow 4: returning user", () => {
  test("alice sees her seeded cart, wishlist, addresses and orders", async ({ page }) => {
    await login(page, "alice@kartly.test");
    await expect(page.getByTestId("account-menu")).toContainText("Hello, Alice Johnson");
    await expect(page.getByTestId("cart-count")).toHaveText("4");

    await page.getByTestId("cart-link").click();
    await expect(page).toHaveURL(/\/cart$/);
    const phone = nth("smartphones", 1);
    const laptop = nth("laptops", 1);
    const shoes = nth("mens-shoes", 1);
    await expect(page.getByTestId(`cart-item-${phone.id}-black-128gb`)).toContainText("Color: Black, Storage: 128GB");
    await expect(page.getByTestId(`cart-item-qty-${phone.id}-black-128gb`)).toHaveText("1");
    await expect(page.getByTestId(`cart-item-qty-${laptop.id}`)).toHaveText("1");
    await expect(page.getByTestId(`cart-item-${shoes.id}-9`)).toContainText("Size: 9");
    await expect(page.getByTestId(`cart-item-qty-${shoes.id}-9`)).toHaveText("2");
    await expect(page.getByTestId("checkout-btn")).toBeEnabled();

    await openNav(page);
    await page.getByTestId("nav-wishlist").click();
    await expect(page).toHaveURL(/\/account\/wishlist$/);
    for (const cat of ["beauty", "fragrances", "furniture", "sunglasses", "womens-bags"]) {
      await expect(page.getByTestId(`wishlist-item-${nth(cat, 1).id}`)).toBeVisible();
    }

    await page.goto("/account/addresses");
    await expect(page.locator('[data-testid^="address-card-"]')).toHaveCount(2);
    await expect(page.getByTestId("address-card-a_alice_home")).toContainText("Default");

    await openNav(page);
    await page.getByTestId("nav-orders").click();
    await expect(page).toHaveURL(/\/account\/orders$/);
    await expect(page.locator('[data-testid^="order-row-KRT-"]')).toHaveCount(4);
    const statuses = await page.getByTestId("order-row-status").allTextContents();
    expect(statuses.sort()).toEqual(["Cancelled", "Delivered", "Placed", "Shipped"]);

    // newest first
    const rows = await page.locator('[data-testid^="order-row-KRT-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(rows).toEqual(["order-row-KRT-000004", "order-row-KRT-000003", "order-row-KRT-000002", "order-row-KRT-000001"]);
  });

  test("wishlist move to cart and remove", async ({ page }) => {
    await login(page, "alice@kartly.test");
    await page.goto("/account/wishlist");
    const beauty = nth("beauty", 1);
    const frag = nth("fragrances", 1);
    await page.getByTestId(`wishlist-move-to-cart-${beauty.id}`).click();
    await expect(page.getByTestId(`wishlist-item-${beauty.id}`)).toHaveCount(0);
    await expect(page.getByTestId("cart-count")).toHaveText("5");
    await page.getByTestId(`wishlist-remove-${frag.id}`).click();
    await expect(page.getByTestId(`wishlist-item-${frag.id}`)).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-testid^="wishlist-item-"]')).toHaveCount(3);
  });

  test("heart on product cards toggles the wishlist", async ({ page }) => {
    await login(page, "bob@kartly.test");
    const p = nth("sunglasses", 1);
    await page.goto("/c/sunglasses");
    await page.getByTestId(`wishlist-toggle-${p.slug}`).click();
    await expect(page.getByTestId(`wishlist-toggle-${p.slug}`)).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByTestId(`wishlist-toggle-${p.slug}`)).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId(`wishlist-toggle-${p.slug}`).click();
    await expect(page.getByTestId(`wishlist-toggle-${p.slug}`)).toHaveAttribute("aria-pressed", "false");
    await page.goto("/account/wishlist");
    await expect(page.getByTestId("empty-wishlist")).toBeVisible();
  });
});
