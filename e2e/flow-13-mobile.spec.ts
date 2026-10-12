import { test, expect, isMobile } from "./fixtures";
import { addToCartFromPdp, goToReview } from "./checkout-helpers";
import { login, settle } from "./helpers";
import { expectNoHorizontalScroll, expectTapTargets } from "./mobile-helpers";
import { nth } from "./seed-oracle";

test.describe("flow 13: mobile layout", () => {
  test.beforeEach(async ({ page }) => {
    // On the desktop project this flow checks the same responsive layout at 390x844.
    if (!isMobile(page)) await page.setViewportSize({ width: 390, height: 844 });
  });

  test("no page scrolls horizontally and tap targets are at least 40px", async ({ page }) => {
    const phone = nth("smartphones", 1);
    const guestPages = ["/", "/search?q=phone", "/c/laptops", `/p/${phone.slug}`, "/cart", "/login", "/register"];
    for (const url of guestPages) {
      await page.goto(url);
      await settle(page);
      await expectNoHorizontalScroll(page, url);
      await expectTapTargets(page, url);
    }
    await login(page, "alice@kartly.test");
    const userPages = ["/cart", "/checkout", "/account/orders", "/account/orders/KRT-000004", "/account/addresses", "/account/wishlist"];
    for (const url of userPages) {
      await page.goto(url);
      await settle(page);
      await expectNoHorizontalScroll(page, url);
      await expectTapTargets(page, url);
    }
  });

  test("menu button opens the nav and its links work", async ({ page }) => {
    await login(page, "alice@kartly.test");
    await page.goto("/");
    await expect(page.getByTestId("nav-orders")).toBeHidden();
    await page.getByTestId("mobile-menu-btn").click();
    await expect(page.getByTestId("nav-orders")).toBeVisible();
    await expectNoHorizontalScroll(page, "menu open");
    await expectTapTargets(page, "menu open");
    await page.getByTestId("nav-orders").click();
    await expect(page).toHaveURL(/\/account\/orders$/);
    await expect(page.getByTestId("nav-orders")).toBeHidden();

    await page.getByTestId("mobile-menu-btn").click();
    await page.getByTestId("nav-wishlist").click();
    await expect(page).toHaveURL(/\/account\/wishlist$/);

    await page.getByTestId("mobile-menu-btn").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("nav-orders")).toBeHidden();

    await page.getByTestId("mobile-menu-btn").click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Laptops" }).click();
    await expect(page).toHaveURL(/\/c\/laptops$/);

    await page.getByTestId("mobile-menu-btn").click();
    await page.getByTestId("logout-btn").click();
    await expect(page.getByTestId("login-link")).toBeVisible();
  });

  test("filters open in the slide-over, apply, and close (button, Esc, backdrop)", async ({ page }) => {
    await page.goto("/search?q=");
    await settle(page);
    const panel = page.getByTestId("mobile-filters-panel");
    await expect(panel).toBeHidden();
    await page.getByTestId("mobile-filters-btn").click();
    await expect(panel).toBeVisible();
    await expectNoHorizontalScroll(page, "filters open");
    await expectTapTargets(page, "filters open");
    await page.getByTestId("filter-category-laptops").click();
    await expect(page).toHaveURL(/category=laptops/);
    await expect(panel).toBeVisible();
    await page.getByTestId("filter-include-out-of-stock").click();
    await expect(page).toHaveURL(/includeOutOfStock=1/);
    await page.getByTestId("mobile-filters-close").click();
    await expect(panel).toBeHidden();
    await expect(page.getByTestId("results-count")).toHaveText("1-4 of 4 results");

    await page.getByTestId("mobile-filters-btn").click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    await page.getByTestId("mobile-filters-btn").click();
    await expect(panel).toBeVisible();
    await page.mouse.click(380, 400);
    await expect(panel).toBeHidden();
  });

  test("cart and checkout are single column; OTP dialog fits and accepts input", async ({ page }) => {
    await login(page, "bob@kartly.test");
    await addToCartFromPdp(page, nth("sunglasses", 1).slug);
    await page.goto("/cart");
    await settle(page);
    const line = page.locator('[data-testid^="cart-item-p"]').first();
    const summary = page.getByTestId("summary-total");
    const lb = (await line.boundingBox())!;
    const sb = (await summary.boundingBox())!;
    expect(sb.y).toBeGreaterThan(lb.y + lb.height - 1);

    await page.getByTestId("checkout-btn").click();
    await expect(page).toHaveURL(/\/checkout$/);
    const step = (await page.getByTestId("checkout-step-address").boundingBox())!;
    const total = (await page.getByTestId("summary-total").boundingBox())!;
    expect(total.y).toBeGreaterThan(step.y + step.height - 1);
    expect(step.width).toBeGreaterThan(300);

    await goToReview(page);
    await expectNoHorizontalScroll(page, "checkout review");
    await page.getByTestId("place-order-btn").click();
    const dialog = page.getByTestId("otp-dialog");
    await expect(dialog).toBeVisible();
    const db = (await dialog.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(db.x).toBeGreaterThanOrEqual(0);
    expect(db.y).toBeGreaterThanOrEqual(0);
    expect(db.x + db.width).toBeLessThanOrEqual(vp.width);
    expect(db.y + db.height).toBeLessThanOrEqual(vp.height);
    await expectTapTargets(page, "otp dialog");
    await page.getByTestId("otp-input").fill("123456");
    await expect(page.getByTestId("otp-input")).toHaveValue("123456");
    await page.getByTestId("otp-submit").click();
    await expect(page.getByTestId("order-confirmation")).toBeVisible();
    await expectNoHorizontalScroll(page, "confirmation");
  });
});
