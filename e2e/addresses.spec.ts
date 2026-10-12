import { test, expect } from "./fixtures";
import { login } from "./helpers";

test.describe("phase 7: address book", () => {
  test("add, edit, set default and delete addresses", async ({ page }) => {
    await login(page, "frank@kartly.test");
    await page.goto("/account/addresses");
    // frank has no addresses: the form is shown directly
    await expect(page.getByTestId("address-fullname")).toBeVisible();
    await page.getByTestId("address-fullname").fill("Frank Moore");
    await page.getByTestId("address-phone").fill("3035550100");
    await page.getByTestId("address-line1").fill("1600 Champa Street");
    await page.getByTestId("address-city").fill("Denver");
    await page.getByTestId("address-state").fill("CO");
    await page.getByTestId("address-zip").fill("80202");
    await page.getByTestId("address-save-btn").click();
    const cards = page.locator('[data-testid^="address-card-"]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Default");

    await page.getByTestId("add-address-btn").click();
    await page.getByTestId("address-fullname").fill("Frank at Work");
    await page.getByTestId("address-phone").fill("3035550101");
    await page.getByTestId("address-line1").fill("200 Work Plaza");
    await page.getByTestId("address-city").fill("Boulder");
    await page.getByTestId("address-state").fill("CO");
    await page.getByTestId("address-zip").fill("80301");
    await page.getByTestId("address-save-btn").click();
    await expect(cards).toHaveCount(2);

    const work = cards.filter({ hasText: "Frank at Work" });
    const workId = (await work.getAttribute("data-testid"))!.replace("address-card-", "");
    await page.getByTestId(`address-edit-${workId}`).click();
    await page.getByTestId("address-line2").fill("Suite 9");
    await page.getByTestId("address-save-btn").click();
    await expect(work).toContainText("Suite 9");

    await page.getByTestId(`address-default-${workId}`).click();
    await expect(cards.first()).toContainText("Frank at Work");
    await expect(cards.first()).toContainText("Default");

    await page.getByTestId(`address-delete-${workId}`).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Default");
    const api = (await (await page.request.get("/api/addresses")).json()).data;
    expect(api).toHaveLength(1);
    expect(api[0].isDefault).toBe(true);
  });
});
