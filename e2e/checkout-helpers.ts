import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "./fixtures";
import { settle } from "./helpers";

export const SUCCESS_CARD = "4242 4242 4242 4242";
export const DECLINED_CARD = "4000 0000 0000 0002";

export async function addToCartFromPdp(page: Page, slug: string, variant?: string[], qty = 1) {
  await page.goto(`/p/${slug}`);
  await settle(page);
  for (const v of variant ?? []) await page.getByTestId(v).click();
  if (qty > 1) await page.getByTestId("qty-select").selectOption(String(qty));
  await page.getByTestId("add-to-cart-btn").click();
  await expect(page.getByTestId("toast")).toContainText("Added");
}

/** From /checkout with a saved default address: address -> delivery -> payment -> review. */
export async function goToReview(page: Page, opts: { delivery?: "standard" | "express"; card?: string; addressId?: string } = {}) {
  await expect(page.getByTestId("checkout-step-address")).toBeVisible();
  if (opts.addressId) await page.getByTestId(`address-option-${opts.addressId}`).click();
  await page.getByTestId("address-continue").click();
  await page.getByTestId(`delivery-${opts.delivery ?? "standard"}`).click();
  await page.getByTestId("delivery-continue").click();
  await fillCard(page, opts.card ?? SUCCESS_CARD);
  await page.getByTestId("payment-continue").click();
  await expect(page.getByTestId("place-order-btn")).toBeVisible();
}

export async function fillCard(page: Page, number: string) {
  await page.getByTestId("card-number").fill(number);
  await page.getByTestId("card-name").fill("Test Shopper");
  await page.getByTestId("card-expiry").fill("12/30");
  await page.getByTestId("card-cvv").fill("123");
}

export async function submitOtp(page: Page, otp: string) {
  await page.getByTestId("otp-input").fill(otp);
  await page.getByTestId("otp-submit").click();
}

export async function ordersOf(request: APIRequestContext) {
  const res = await request.get("/api/orders");
  expect(res.status()).toBe(200);
  return (await res.json()).data as { total: number; orders: { id: string; orderNumber: string; status: string; total: number; shippingAddress: { line1: string } }[] };
}
