import { test, expect } from "./fixtures";
import { login, settle } from "./helpers";
import { $, expectedTotals, nth } from "./seed-oracle";

async function addFromPdp(page: import("@playwright/test").Page, slug: string, qty = 1) {
  await page.goto(`/p/${slug}`);
  await settle(page);
  if (qty > 1) await page.getByTestId("qty-select").selectOption(String(qty));
  await page.getByTestId("add-to-cart-btn").click();
  await expect(page.getByTestId("toast")).toContainText("Added");
}

test.describe("flow 5: coupons", () => {
  test("EXPIRED15 rejected, SAVE10 rejected under $50 and accepted at $50+", async ({ page }) => {
    await login(page, "bob@kartly.test");
    const cheap = nth("beauty", 1); // 9.99
    const perfume = nth("fragrances", 1); // 49.99
    await addFromPdp(page, cheap.slug, 2);
    await page.goto("/cart");
    await settle(page);
    const small = Math.round(cheap.price * 2 * 100) / 100;
    await expect(page.getByTestId("summary-subtotal")).toHaveText($(small));

    await page.getByTestId("coupon-input").fill("EXPIRED15");
    await page.getByTestId("apply-coupon-btn").click();
    await expect(page.getByTestId("coupon-message")).toHaveText("This coupon has expired.");
    await expect(page.getByTestId("summary-discount")).toHaveText("$0.00");

    await page.getByTestId("coupon-input").fill("NOTACODE");
    await page.getByTestId("apply-coupon-btn").click();
    await expect(page.getByTestId("coupon-message")).toHaveText("This coupon code is invalid.");

    await page.getByTestId("coupon-input").fill("SAVE10");
    await page.getByTestId("apply-coupon-btn").click();
    await expect(page.getByTestId("coupon-message")).toHaveText(`Add ${$(Math.round((50 - small) * 100) / 100)} more to use this coupon.`);
    await expect(page.getByTestId("summary-discount")).toHaveText("$0.00");

    await addFromPdp(page, perfume.slug);
    await page.goto("/cart");
    await settle(page);
    const subtotal = Math.round((small + perfume.price) * 100) / 100;
    await page.getByTestId("coupon-input").fill("save10");
    await page.getByTestId("apply-coupon-btn").click();
    await expect(page.getByTestId("coupon-message")).toHaveText("Coupon SAVE10 applied.");
    const t = expectedTotals(subtotal, "SAVE10", "standard");
    await expect(page.getByTestId("summary-subtotal")).toHaveText($(t.subtotal));
    await expect(page.getByTestId("summary-discount")).toHaveText($(t.discount));
    await expect(page.getByTestId("summary-shipping")).toHaveText($(t.shipping));
    await expect(page.getByTestId("summary-tax")).toHaveText($(t.tax));
    await expect(page.getByTestId("summary-total")).toHaveText($(t.total));

    // dropping below the minimum changes the message and zeroes the discount
    await page.getByTestId(`remove-item-${perfume.id}`).click();
    await expect(page.getByTestId("coupon-message")).toHaveText(`Add ${$(Math.round((50 - small) * 100) / 100)} more to use this coupon.`);
    await expect(page.getByTestId("summary-discount")).toHaveText("$0.00");
    const t2 = expectedTotals(small, null, "standard");
    await expect(page.getByTestId("summary-total")).toHaveText($(t2.total));

    // coming back above the minimum re-applies it; remove-coupon clears it
    for (let q = 3; q <= 6; q++) {
      await page.getByTestId(`qty-increase-${cheap.id}`).click();
      await expect(page.getByTestId(`cart-item-qty-${cheap.id}`)).toHaveText(String(q));
    }
    // 5 x 9.99 = 49.95 is still under the minimum; 6 x 9.99 = 59.94 qualifies
    const sub5 = Math.round(cheap.price * 6 * 100) / 100;
    await expect(page.getByTestId("coupon-message")).toHaveText("Coupon SAVE10 applied.");
    await expect(page.getByTestId("summary-total")).toHaveText($(expectedTotals(sub5, "SAVE10", "standard").total));
    await page.getByTestId("remove-coupon-btn").click();
    await expect(page.getByTestId("coupon-message")).toHaveCount(0);
    await expect(page.getByTestId("summary-total")).toHaveText($(expectedTotals(sub5, null, "standard").total));
  });

  test("dave's seeded cart shows SAVE10 applied and saved-for-later lines", async ({ page }) => {
    await login(page, "dave@kartly.test");
    await page.goto("/cart");
    const bed = nth("furniture", 1);
    await expect(page.getByTestId("coupon-message")).toHaveText("Coupon SAVE10 applied.");
    const t = expectedTotals(bed.price, "SAVE10", "standard");
    await expect(page.getByTestId("summary-discount")).toHaveText($(t.discount));
    await expect(page.getByTestId("summary-total")).toHaveText($(t.total));
    const sun = nth("sunglasses", 1);
    const bag = nth("womens-bags", 1);
    await expect(page.getByTestId(`saved-item-${sun.id}`)).toBeVisible();
    await expect(page.getByTestId(`saved-item-${bag.id}`)).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.getByTestId(`move-to-cart-${sun.id}`).click();
    await expect(page.getByTestId(`cart-item-${sun.id}`)).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await page.getByTestId(`save-for-later-${bed.id}`).click();
    await expect(page.getByTestId(`saved-item-${bed.id}`)).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    // only the sunglasses (under $50) remain: SAVE10 no longer applies
    await expect(page.getByTestId("coupon-message")).toContainText("more to use this coupon.");
    await expect(page.getByTestId("summary-discount")).toHaveText("$0.00");
  });
});
