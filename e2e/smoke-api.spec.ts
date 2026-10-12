import { test, expect } from "./fixtures";

test.describe("phase 1: platform", () => {
  test("health endpoint reports ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("seed data is loaded and reset restores it", async ({ request }) => {
    const cats = await (await request.get("/api/categories")).json();
    expect(cats.data.length).toBe(24);
    const products = await (await request.get("/api/products?includeOutOfStock=1")).json();
    expect(products.data.total).toBe(93);

    await request.post("/api/auth/login", { data: { email: "bob@kartly.test", password: "Password@123" } });
    const add = await request.post("/api/cart/items", { data: { productId: "p1", quantity: 2 } });
    expect(add.status()).toBe(201);
    expect((await (await request.get("/api/cart")).json()).data.count).toBe(2);

    expect((await request.post("/api/dev/reset")).ok()).toBeTruthy();
    // sessions are cleared by the reset, so the cart is now a guest cart
    expect((await (await request.get("/api/cart")).json()).data.count).toBe(0);
    await request.post("/api/auth/login", { data: { email: "bob@kartly.test", password: "Password@123" } });
    expect((await (await request.get("/api/cart")).json()).data.count).toBe(0);
  });

  test("API errors use the { error: { code, message } } envelope", async ({ request }) => {
    const res = await request.get("/api/products/does-not-exist");
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(typeof body.error.message).toBe("string");

    const bad = await request.get("/api/products?sort=bogus");
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error.fields.sort).toBeTruthy();

    const unauth = await request.get("/api/orders");
    expect(unauth.status()).toBe(401);
  });
});
