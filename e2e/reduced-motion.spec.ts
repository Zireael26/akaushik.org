import { expect, test, type Page } from '@playwright/test';

/**
 * The reduced-motion contract, for the design that is actually shipped.
 *
 * This file used to assert on a CSS marquee (`.hero-marquee .marquee-track`,
 * `animationPlayState`) and on the Three.js Wanderer's lazy chunk. Both were
 * deleted with the parchment design, and the specs were left in place
 * "as the baseline contract" — which meant permanently red. They are gone.
 *
 * The pixel fields are canvases driven by requestAnimationFrame, so there is no
 * `animationPlayState` to read. What a user can observe is whether the picture
 * changes, and that is what these assert: sample the canvas twice, a second
 * apart, and compare. Still under reduced motion, moving without it. The other
 * half of the contract is bytes — a motion-disabled visitor should not pay for
 * video they will never see.
 */
test.describe.configure({ timeout: 60_000 });

const SETTLE_MS = 1200;

/** Two samples of a canvas, a beat apart. */
async function sampleTwice(page: Page, selector: string): Promise<[string, string]> {
  const canvas = page.locator(selector).first();
  await expect(canvas).toBeAttached();
  // Let the field mount and reach a steady state before the first sample.
  await page.waitForTimeout(SETTLE_MS);
  const read = () =>
    canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png').slice(0, 4096));
  const a = await read();
  await page.waitForTimeout(SETTLE_MS);
  const b = await read();
  return [a, b];
}

test.describe('prefers-reduced-motion', () => {
  test('the hero field keeps drifting when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');

    const [a, b] = await sampleTwice(page, '.px-heatfield canvas');
    // If these match, the field is frozen for everyone and the rest of this
    // file proves nothing.
    expect(a).not.toBe(b);
  });

  test('the hero field holds still when the user asks for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const [a, b] = await sampleTwice(page, '.px-heatfield canvas');
    expect(a).toBe(b);
  });

  test('the site motion switch stops the field too, not only the OS setting', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'off'));

    const [a, b] = await sampleTwice(page, '.px-heatfield canvas');
    expect(a).toBe(b);
  });

  test('a motion-disabled visitor is never sent video bytes', async ({ page }) => {
    const videoRequests: string[] = [];
    page.on('request', (r) => {
      if (/\.(mp4|webm)(\?|$)/.test(r.url())) videoRequests.push(r.url());
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/neev');
    await page.waitForTimeout(SETTLE_MS);

    expect(videoRequests, `unexpected video requests: ${videoRequests.join(', ')}`).toHaveLength(0);
  });

  test('the SVG floor is what a motion-disabled visitor sees instead', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/vericite');

    // Every reel draws an SVG floor underneath the video precisely so there is
    // something to show when the video is gated off.
    const media = page.locator('.px-work-detail-reel, .px-work-inline-loop').first();
    await expect(media).toBeVisible();
    await expect(media.locator('svg').first()).toBeVisible();
  });
});
