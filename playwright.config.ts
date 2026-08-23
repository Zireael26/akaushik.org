import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite. 5 projects: Chromium/Firefox/WebKit desktop (1440×900)
// + Chromium tablet (768×1024) + WebKit mobile (375×667).
// Runs against a local `pnpm dev` server by default. CI builds and starts the
// production app on localhost, then sets `PLAYWRIGHT_BASE_URL` to that server
// (see `.github/workflows/e2e.yml`).
//
// Tests target user-visible behaviour only — section presence, nav anchor
// scroll, theme toggle, reduced-motion honoring. No internal state, no
// brittle selectors, no waiting for specific CSS-animated frames.

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';
const IS_CI = !!process.env.CI;

/**
 * Playwright's bundled Firefox cannot launch on macOS here, and it fails by
 * hanging rather than erroring.
 *
 * The symptom is `sandbox_extension_issue_file_to_process … Operation not
 * permitted` followed by `RenderCompositorSWGL failed mapping default
 * framebuffer`. Request-only specs pass because they never open a page; the
 * first `page.goto` hangs until the timeout, so with retries a full local run
 * costs minutes per spec and produces nothing. Chromium and WebKit are
 * unaffected on the same machine.
 *
 * It is not the harness sandbox — verified by launching with sandboxing
 * disabled, which changed nothing. The distinguishing factor is the OS: this
 * is macOS 27.0 (build 26A5416b), a beta.
 *
 * Skipped on macOS rather than deleted, because Firefox is not broken
 * everywhere: it runs all 61 specs on CI's Linux runners, so the coverage is
 * real and only this platform is affected. Set `PLAYWRIGHT_FORCE_FIREFOX=1` to
 * override and re-test after a Playwright or OS update.
 *
 * Keyed on the platform alone, deliberately not on `!IS_CI`. Running against a
 * deployed URL requires `CI=1` — it is what disables the local `webServer` —
 * so a `!IS_CI` guard would hand Firefox back to the one macOS run most likely
 * to want the full matrix. CI is Linux, so the platform test already excludes
 * it.
 */
const SKIP_FIREFOX = process.platform === 'darwin' && !process.env.PLAYWRIGHT_FORCE_FIREFOX;

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
    ...(SKIP_FIREFOX
      ? []
      : [
          {
            name: 'firefox-desktop',
            use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
          },
        ]),
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    // Tablet
    {
      name: 'chromium-tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    // Mobile — retain Mobile Safari's touch/browser behavior while overriding
    // Playwright's 320px iPhone SE viewport to the PRD's exact 375×667 contract.
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone SE'], viewport: { width: 375, height: 667 } },
    },
  ],

  // Local runs only — CI starts its localhost production server explicitly.
  webServer: IS_CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
