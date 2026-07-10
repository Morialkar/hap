import { defineConfig, devices } from "@playwright/test";

const E2E_TARGET = process.env.E2E_TARGET ?? "v2";
const V3_API_PORT = Number(process.env.E2E_V3_API_PORT ?? 18080);
const V3_CLIENT_PORT = Number(process.env.E2E_V3_CLIENT_PORT ?? 15173);
const BASE_URL =
  process.env.TARGET_BASE_URL ??
  (E2E_TARGET === "v3" ? `http://127.0.0.1:${V3_CLIENT_PORT}` : "http://localhost:8056");
const V3_API_ENV =
  "APP_ENV=e2e DB_CONNECTION=sqlite DB_DATABASE=database/e2e.sqlite SESSION_DRIVER=file CACHE_STORE=array QUEUE_CONNECTION=sync";

const webServer =
  E2E_TARGET === "v3" && process.env.E2E_V3_WEB_SERVER === "1"
    ? [
        {
          command: `cd ../../apps/api && ${V3_API_ENV} php artisan serve --host 127.0.0.1 --port ${V3_API_PORT}`,
          url: `http://127.0.0.1:${V3_API_PORT}/api/v1/ping`,
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command:
            `cd ../.. && PATH=/Users/nao/.nvm/versions/node/v25.0.0/bin:$PATH VITE_DEV_PORT=${V3_CLIENT_PORT} VITE_API_PROXY_TARGET=http://127.0.0.1:${V3_API_PORT} pnpm --filter client dev --host 127.0.0.1 --port ${V3_CLIENT_PORT}`,
          url: `http://127.0.0.1:${V3_CLIENT_PORT}`,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : undefined;

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  globalSetup: "./global-setup.ts",
  retries: 0,
  workers: 1,
  reporter: "list",
  webServer,
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
