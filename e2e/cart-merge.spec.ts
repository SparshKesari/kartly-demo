import { test, expect } from "./fixtures";
import { nth } from "./seed-oracle";

test.describe("phase 5: guest cart and merge", () => {
  test("guest cart merges into the user cart, quantities add up and are capped", async ({ request }) => {
    const phone = nth("smartphones", 1);
    const lowBeauty = nth("beauty", 3); // stock 3
    // guest cart
    expect((await request.post("/api/cart/items", { data: { productId: phone.id, quantity: 2, variant: { Color: "Black", Storage: "128GB" } } })).status()).toBe(201);
    expect((await request.post("/api/cart/items", { data: { productId: lowBeauty.id, quantity: 2 } })).status()).toBe(201);
    // variant products need every option
    const missing = await request.post("/api/cart/items", { data: { productId: phone.id, quantity: 1, variant: { Color: "Black" } } });
    expect(missing.status()).toBe(422);
    let cart = (await (await request.get("/api/cart")).json()).data;
    expect(cart.count).toBe(4);

    // alice already has phone black/128GB x1; carol-style cap on beauty (stock 3)
    const login = await request.post("/api/auth/login", { data: { email: "alice@kartly.test", password: "Password@123" } });
    expect(login.status()).toBe(200);
    expect((await login.json()).data.mergedCount).toBe(4);
    cart = (await (await request.get("/api/cart")).json()).data;
    const line = cart.items.find((l: { lineId: string }) => l.lineId === `${phone.id}-black-128gb`);
    expect(line.quantity).toBe(3);
    const beautyLine = cart.items.find((l: { lineId: string }) => l.lineId === lowBeauty.id);
    expect(beautyLine.quantity).toBe(2);
    expect(cart.count).toBe(8);

    // adding beyond stock caps the line
    const capped = await request.post("/api/cart/items", { data: { productId: lowBeauty.id, quantity: 5 } });
    expect(capped.status()).toBe(201);
    expect((await capped.json()).data.quantity).toBe(3);
    const over = await request.post("/api/cart/items", { data: { productId: lowBeauty.id, quantity: 1 } });
    expect(over.status()).toBe(409);
    const oos = await request.post("/api/cart/items", { data: { productId: nth("laptops", 2).id, quantity: 1 } });
    expect(oos.status()).toBe(409);
  });

  test("guest cart persists across pages and the header count is live", async ({ page }) => {
    const p = nth("groceries", 1);
    await page.goto(`/c/groceries`);
    await page.getByTestId(`add-to-cart-${p.slug}`).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.getByTestId(`add-to-cart-${p.slug}`).click();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await page.goto("/cart");
    await expect(page.getByTestId(`cart-item-qty-${p.id}`)).toHaveText("2");
    await page.getByTestId(`qty-decrease-${p.id}`).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.getByTestId(`remove-item-${p.id}`).click();
    await expect(page.getByTestId("empty-cart")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("0");
    await expect(page.getByTestId("checkout-btn")).toBeDisabled();
  });
});
