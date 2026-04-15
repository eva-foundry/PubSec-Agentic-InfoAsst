// ---------------------------------------------------------------------------
// playwright.config.ts — E2E test configuration for all three EVA portals
// ---------------------------------------------------------------------------

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'html',
  outputDir: 'test-results',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'portal-self-service',
      testMatch: ['portal-self-service.spec.ts', 'i18n.spec.ts', 'a11y.spec.ts', 'smoke.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
    {
      name: 'portal-admin',
      testMatch: ['portal-admin.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174',
      },
    },
    {
      name: 'portal-ops',
      testMatch: ['portal-ops.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5175',
      },
    },
  ],

  webServer: [
    {
      command: 'cd services/api-gateway && uvicorn app.main:app --host 0.0.0.0 --port 8000',
      port: 8000,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --workspace=@eva/portal-self-service',
      port: 5173,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --workspace=@eva/portal-admin -- --port 5174',
      port: 5174,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --workspace=@eva/portal-ops -- --port 5175',
      port: 5175,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
