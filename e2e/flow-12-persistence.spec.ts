import { spawn, execFileSync, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { test, expect } from "./fixtures";
import { SUCCESS_CARD, fillCard, submitOtp } from "./checkout-helpers";
import { nth, seed } from "./seed-oracle";

const ROOT = path.join(__dirname, "..");
const PROD = process.env.E2E_SERVER === "prod";

async function waitForHealth(base: string, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${base} did not become healthy`);
}

function startServer(port: number, dataDir: string, distDir: string): ChildProcess {
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const args = PROD ? [nextBin, "start", "-p", String(port)] : [nextBin, "dev", "-p", String(port)];
  return spawn(process.execPath, args, {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(port),
      KARTLY_DATA_DIR: dataDir,
      KARTLY_ALLOW_RESET: "1",
      ...(PROD ? {} : { NEXT_DIST_DIR: distDir }),
    },
  });
}

async function stopServer(proc: ChildProcess | null) {
  if (!proc || proc.pid === undefined) return;
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    return;
  }
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      process.kill(-proc.pid, 0);
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      return;
    }
  }
  try {
    process.kill(-proc.pid, "SIGKILL");
  } catch {
    // already gone
  }
}

test.describe("flow 12: persistence", () => {
  test.setTimeout(420_000);

  test("orders, stock and cart survive a server restart; npm run reset restores the seed", async ({ page }, testInfo) => {
    const mainPort = Number(process.env.PORT || 3100);
    const port = mainPort + 50 + (testInfo.project.name === "mobile" ? 100 : 0);
    const base = `http://localhost:${port}`;
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `kartly-flow12-${testInfo.project.name}-`));
    const distDir = `.next-flow12-${port}`;
    let server: ChildProcess | null = null;
    // `next dev` with a custom distDir rewrites tsconfig.json; keep the original.
    const tsconfigPath = path.join(ROOT, "tsconfig.json");
    const tsconfig = fs.readFileSync(tsconfigPath, "utf8");
    try {
      // the live db does not exist yet: the server must create it from data/seed.json
      server = startServer(port, dataDir, distDir);
      await waitForHealth(base);
      expect(fs.existsSync(path.join(dataDir, "db.json"))).toBeTruthy();

      const glasses = nth("sunglasses", 1);
      const extra = nth("beauty", 1);
      const seededStock = seed().products.find((p) => p.id === glasses.id)!.stock;

      await page.goto(`${base}/login`);
      await page.getByTestId("login-email").fill("bob@kartly.test");
      await page.getByTestId("login-password").fill("Password@123");
      await page.getByTestId("login-submit").click();
      await expect(page.getByTestId("account-menu")).toContainText("Hello, Bob");

      await page.goto(`${base}/p/${glasses.slug}`);
      await page.waitForLoadState("networkidle");
      await page.getByTestId("qty-select").selectOption("2");
      await page.getByTestId("add-to-cart-btn").click();
      await expect(page.getByTestId("cart-count")).toHaveText("2");
      await page.goto(`${base}/checkout`);
      await page.getByTestId("address-continue").click();
      await page.getByTestId("delivery-continue").click();
      await fillCard(page, SUCCESS_CARD);
      await page.getByTestId("payment-continue").click();
      await page.getByTestId("place-order-btn").click();
      await submitOtp(page, "123456");
      await expect(page.getByTestId("order-confirmation")).toBeVisible();
      const orderNumber = (await page.getByTestId("order-number").textContent())!.trim();

      // leave something in the cart too
      await page.goto(`${base}/c/beauty`);
      await page.waitForLoadState("networkidle");
      await page.getByTestId(`add-to-cart-${extra.slug}`).click();
      await expect(page.getByTestId("cart-count")).toHaveText("1");

      const stockBefore = (await (await page.request.get(`${base}/api/products/${glasses.slug}`)).json()).data.product.stock;
      expect(stockBefore).toBe(seededStock - 2);

      // restart the server on the same data dir
      await stopServer(server);
      server = startServer(port, dataDir, distDir);
      await waitForHealth(base);

      await page.goto(`${base}/account/orders`);
      await expect(page.getByTestId("account-menu")).toContainText("Hello, Bob");
      await expect(page.getByTestId(`order-row-${orderNumber}`)).toBeVisible();
      await expect(page.getByTestId("cart-count")).toHaveText("1");
      await page.goto(`${base}/cart`);
      await expect(page.getByTestId(`cart-item-qty-${extra.id}`)).toHaveText("1");
      const stockAfter = (await (await page.request.get(`${base}/api/products/${glasses.slug}`)).json()).data.product.stock;
      expect(stockAfter).toBe(stockBefore);

      // npm run reset returns this data dir to the seed state
      execFileSync("npm", ["run", "reset"], { cwd: ROOT, env: { ...process.env, KARTLY_DATA_DIR: dataDir }, stdio: "ignore" });
      const stockReset = (await (await page.request.get(`${base}/api/products/${glasses.slug}`)).json()).data.product.stock;
      expect(stockReset).toBe(seededStock);
      await page.goto(`${base}/account/orders`);
      await expect(page).toHaveURL(/\/login/); // sessions are part of the reset
      await page.getByTestId("login-email").fill("bob@kartly.test");
      await page.getByTestId("login-password").fill("Password@123");
      await page.getByTestId("login-submit").click();
      await expect(page.getByTestId("empty-orders")).toBeVisible();
      await expect(page.getByTestId("cart-count")).toHaveText("0");
    } finally {
      await stopServer(server);
      fs.rmSync(dataDir, { recursive: true, force: true });
      if (!PROD) fs.rmSync(path.join(ROOT, distDir), { recursive: true, force: true });
      if (fs.readFileSync(tsconfigPath, "utf8") !== tsconfig) fs.writeFileSync(tsconfigPath, tsconfig);
    }
  });
});
