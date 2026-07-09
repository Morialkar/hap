import { defineConfig, devices } from '@playwright/test';

const port = process.env.HAP_CLIENT_PORT ?? '5173';
const host = '127.0.0.1';
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm dev --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
