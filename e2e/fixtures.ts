import { test as base, expect, type Page } from "@playwright/test";

/** Console messages that are not app defects (browser noise). */
const IGNORED = [/Download the React DevTools/i, /\[Fast Refresh\]/i, /\[HMR\]/i];

type Fixtures = { consoleErrors: string[]; allowConsole: (pattern: RegExp) => void };

/**
 * Shared test fixture:
 *  - resets the database before every test (POST /api/dev/reset)
 *  - fails the test if the browser logged any console error, page error or hydration warning
 */
export const test = base.extend<Fixtures & { allowed: RegExp[] }>({
  allowed: async ({}, use) => {
    await use([]);
  },
  /** Lets a test declare an expected console message (e.g. the 404 document of a not-found page). */
  allowConsole: async ({ allowed }, use) => {
    await use((pattern: RegExp) => {
      allowed.push(pattern);
    });
  },
  consoleErrors: [
    async ({ page, request, allowed }, use) => {
      const res = await request.post("/api/dev/reset");
      expect(res.ok(), "reset endpoint must succeed").toBeTruthy();
      const errors: string[] = [];
      page.on("console", (msg) => {
        const text = msg.text();
        if (IGNORED.some((r) => r.test(text))) return;
        if (msg.type() === "error" || /hydrat/i.test(text)) errors.push(`[console.${msg.type()}] ${text}`);
      });
      page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
      await use(errors);
      const unexpected = errors.filter((e) => !allowed.some((re) => re.test(e)));
      expect(unexpected, "browser console must be free of errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const PASSWORD = "Password@123";

export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}
