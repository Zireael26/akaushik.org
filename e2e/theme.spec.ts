import { test, expect } from '@playwright/test';

test.describe('Theme toggle', () => {
  test('flips html[data-mode] between light and dark and persists to localStorage', async ({
    page,
  }) => {
    await page.goto('/');

    // Read the initial mode (depends on prefers-color-scheme + any saved pref).
    const initialMode = await page.locator('html').getAttribute('data-mode');

    // Pixel button is `aria-label="Switch between day and night"` (was "Toggle color theme" in parchment).
    // Same live theme switch, accessible name renamed — selector migrated, assertion strength preserved.
    const toggle = page.getByRole('button', { name: /switch between day and night/i });
    await toggle.click();

    const afterMode = await page.locator('html').getAttribute('data-mode');
    expect(afterMode).not.toBe(initialMode);
    expect(['light', 'dark']).toContain(afterMode);

    const persisted = await page.evaluate(() =>
      window.localStorage.getItem('abhishek.portfolio.mode'),
    );
    expect(persisted).toBe(afterMode);

    // Flip back — tests it's idempotent both ways.
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', initialMode ?? /.+/);
  });
});
