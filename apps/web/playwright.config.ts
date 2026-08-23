import { defineConfig, devices } from '@playwright/test';

const port = 3210;
const adminApiPort = 3999;
const adminToken = 'playwright-admin-token';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx e2e/mock-admin-api.ts',
      port: adminApiPort,
      timeout: 30_000,
      reuseExistingServer: false,
      env: {
        BLOG_E2E_ADMIN_PORT: String(adminApiPort),
        BLOG_E2E_ADMIN_TOKEN: adminToken,
      },
    },
    {
      command: `pnpm build && pnpm exec next start -p ${port}`,
      url: `http://localhost:${port}/blog`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        BLOG_E2E_FIXTURES: '1',
        NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
        NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${adminApiPort}`,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
