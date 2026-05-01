import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './features',
  testMatch: '**/*.steps.ts',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { viewport: { width: 1024, height: 768 } } }], // tablet split layout
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
