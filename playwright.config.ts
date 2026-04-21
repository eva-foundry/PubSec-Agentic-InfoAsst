import { defineConfig, devices } from '@playwright/test';

// When E2E_BASE_URL is set (Azure E2E against a live SWA), skip the local
// webServer + point Playwright at the live URL. Locally, fall back to a
// dev server on :5173.
const liveBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: liveBaseUrl ? 60_000 : 30_000,
  retries: liveBaseUrl ? 1 : 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : [['list']],
  outputDir: 'test-results',

  use: {
    baseURL: liveBaseUrl ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  ...(liveBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npm run dev --workspace=@aia/portal-unified',
          port: 5173,
          timeout: 30_000,
          reuseExistingServer: !process.env.CI,
        },
      }),
});
