import { defineConfig, devices } from "@playwright/test";

const inCi = process.env["CI"] !== undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: inCi,
  retries: inCi ? 2 : 0,
  ...(inCi ? { workers: 1 } : {}),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --outDir dist",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !inCi,
      timeout: 120_000,
    },
    {
      command:
        "npm run build:qa && npm run preview -- --host 127.0.0.1 --port 4174 --outDir dist-qa",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !inCi,
      timeout: 120_000,
    },
  ],
});
