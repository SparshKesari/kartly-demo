import type { APIRequestContext, Page } from "@playwright/test";
import { expect, PASSWORD, isMobile } from "./fixtures";

export async function login(page: Page, email: string, password = PASSWORD, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("account-menu")).toContainText("Hello,", { timeout: 20_000 });
  await expect(page.getByTestId("login-link")).toHaveCount(0);
}

/** Opens the mobile nav drawer when needed so header nav links are clickable. */
export async function openNav(page: Page) {
  if (isMobile(page)) {
    await page.getByTestId("mobile-menu-btn").click();
  }
}

export async function apiLogin(request: APIRequestContext, email: string, password = PASSWORD) {
  const res = await request.post("/api/auth/login", { data: { email, password } });
  expect(res.status()).toBe(200);
  return res;
}

export async function productBySlug(request: APIRequestContext, slug: string) {
  const res = await request.get(`/api/products/${slug}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.product as { id: string; slug: string; stock: number; price: number; title: string };
}

export function money(text: string | null): number {
  return Number((text ?? "").replace(/[^0-9.-]/g, ""));
}

/** Waits until the page is hydrated and idle after a client navigation. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

/** Runs `fn` with the filter panel open (mobile slide-over), then closes it. */
export async function withFilters(page: Page, fn: () => Promise<void>) {
  const mobile = isMobile(page);
  if (mobile) {
    await page.getByTestId("mobile-filters-btn").click();
    await expect(page.getByTestId("mobile-filters-panel")).toBeVisible();
  }
  await fn();
  if (mobile) {
    await page.getByTestId("mobile-filters-close").click();
    await expect(page.getByTestId("mobile-filters-panel")).toBeHidden();
  }
}

/** Slugs of the product cards currently shown in the results grid, in order. */
export async function resultSlugs(page: Page): Promise<string[]> {
  const ids = await page.locator('ul[aria-label="Search results"] article[data-testid^="product-card-"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid") ?? ""),
  );
  return ids.map((id) => id.replace(/^product-card-/, ""));
}

export async function search(page: Page, q: string) {
  await page.getByTestId("search-input").fill(q);
  await page.getByTestId("search-submit").click();
  const encoded = new URLSearchParams({ q }).toString();
  await expect(page).toHaveURL(new RegExp(`/search\\?${encoded.replace(/[+]/g, "\\+")}`));
}
