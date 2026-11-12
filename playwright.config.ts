import { defineConfig, devices } from '@playwright/test';

// End-to-end + real-browser accessibility tests. Run `pnpm build` first.
// The vanilla example uses 4310, not 4321, so it never collides with `astro dev`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive/ },
  ],
  webServer: [
    {
      command: 'node apps/examples/vanilla/serve.mjs',
      port: 4310,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @bitkit-ui/website exec astro preview --port 4400',
      url: 'http://localhost:4400/bitkit-ui/',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
