import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/web',
  testMatch: /e2e\.spec\.ts/,
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    headless: true,
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
