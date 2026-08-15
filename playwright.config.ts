import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? (process.env.CMS_E2E_TEST_AUTH === "1" ? "http://127.0.0.1:3100" : "http://127.0.0.1:3000"),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: process.env.CMS_E2E_TEST_AUTH === "1" ? "PORT=3100 CMS_E2E_TEST_AUTH=1 VITE_CMS_E2E_TEST_AUTH=1 pnpm dev" : "pnpm dev",
    url: process.env.CMS_E2E_TEST_AUTH === "1" ? "http://127.0.0.1:3100" : "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI && process.env.CMS_E2E_TEST_AUTH !== "1",
    timeout: 60_000,
  },
});
