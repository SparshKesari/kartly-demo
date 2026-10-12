import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

export async function expectNoHorizontalScroll(page: Page, label: string) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  expect(dims.scroll, `${label}: page must not scroll horizontally`).toBeLessThanOrEqual(dims.client);
  expect(dims.body, `${label}: body must not overflow`).toBeLessThanOrEqual(dims.client);
}

/** Every visible interactive element must be at least 40x40 CSS px. */
export async function tapTargetViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const els = document.querySelectorAll<HTMLElement>('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]');
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return;
      if (el.closest('[aria-hidden="true"]')) return;
      // skip visually hidden (sr-only) elements
      if (r.width <= 1 && r.height <= 1) return;
      if (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)") return;
      if (r.height < 39.5 || r.width < 39.5) {
        const id = el.getAttribute("data-testid") || el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 30) || el.tagName;
        out.push(`${el.tagName.toLowerCase()} "${id}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    return out;
  });
}

export async function expectTapTargets(page: Page, label: string) {
  expect(await tapTargetViolations(page), `${label}: tap targets must be at least 40px`).toEqual([]);
}
