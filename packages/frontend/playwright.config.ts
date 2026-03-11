import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './features',
  testMatch: '**/*.steps.ts',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 5'] } }], // mobile viewport
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
