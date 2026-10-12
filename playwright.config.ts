import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT || 3100);
const baseURL = `http://localhost:${port}`;
/** E2E_SERVER=prod runs against `npm start` (requires `npm run build` first); default is `npm run dev`. */
const useProd = process.env.E2E_SERVER === "prod";

export default defineConfig({
  testDir: "./e2e",
  outputDir: `./test-results/port-${port}`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: `test-results/results-${port}.json` }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: useProd ? "KARTLY_ALLOW_RESET=1 npm start" : "npm run dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      PORT: String(port),
      ...(process.env.KARTLY_DATA_DIR ? { KARTLY_DATA_DIR: process.env.KARTLY_DATA_DIR } : {}),
      ...(useProd ? { KARTLY_ALLOW_RESET: "1" } : {}),
    },
    stdout: "ignore",
    stderr: "pipe",
  },
});
