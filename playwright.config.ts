process.env.DATABASE_PATH = process.env.DATABASE_PATH || 'data/db_test.json';

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Hermes Task Hub.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:47914',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx next start -p 47914',
    url: 'http://localhost:47914',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
