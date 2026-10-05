import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  // The previous specs remain as historical flows. v3 covers the approved replacement UI.
  testDir: './tests/personal', testMatch: ['**/v3.spec.ts', '**/v4.spec.ts'], workers: 1, timeout: 60000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:47915', timezoneId: 'UTC', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PERSONAL_TEST_EXTERNAL_SERVER === '1' ? undefined : { command: 'node scripts/local-preview.mjs --test', url: 'http://127.0.0.1:47915/login', timeout: 120000, reuseExistingServer: false },
});
