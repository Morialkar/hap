import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.TARGET_BASE_URL ?? "http://localhost:8056";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
