import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite. 5 projects: Chromium/Firefox/WebKit desktop (1440×900)
// + Chromium tablet (768×1024) + WebKit mobile (iPhone SE, 375×667).
// Runs against a local `pnpm dev` server by default; CI runs against the
// Vercel preview URL via `PLAYWRIGHT_BASE_URL` (see
// `.github/workflows/e2e.yml`).
//
// Tests target user-visible behaviour only — section presence, nav anchor
// scroll, theme toggle, reduced-motion honoring. No internal state, no
// brittle selectors, no waiting for specific CSS-animated frames.

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 2 : undefined,
  reporter: IS_CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    // Tablet
    {
      name: 'chromium-tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    // Mobile — iPhone SE (375×667) matches the PRD's 375 mobile breakpoint
    // spec. iPhone 13 resolves to 390×844 which is close but off-contract.
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone SE'] },
    },
  ],

  // Local runs only — CI sets PLAYWRIGHT_BASE_URL and skips webServer.
  webServer: IS_CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
