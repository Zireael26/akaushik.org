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
 * apart, and compare. Still under reduced motion, moving without it.
 *
 * The other half of the contract is still bytes — a motion-disabled visitor
 * should not pay for media they will never see. The case-study reels are
 * pixel fields now (ADR-0020), so that half is structural: a field ships
 * zero media requests for anyone, which the `/work/neev` navigation asserts
 * anyway. What reduced motion changes for a field is that it must hold
 * still — same sampling technique as the hero specs above, on the reel.
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

function shipitStatus(page: Page, label: string) {
  return page
    .locator('#shipit .px-shipit-status > div')
    .filter({ hasText: label })
    .locator('dd');
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

  test('a motion-disabled visitor is sent no media bytes on a case study', async ({ page }) => {
    const mediaRequests: string[] = [];
    page.on('request', (r) => {
      if (/\.(mp4|webm|webp)(\?|$)/.test(r.url())) mediaRequests.push(r.url());
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/neev');
    await page.waitForTimeout(SETTLE_MS);

    expect(
      mediaRequests,
      `unexpected media requests: ${mediaRequests.join(', ')}`,
    ).toHaveLength(0);
  });

  test('a case-study reel field holds still under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/vericite');

    // The reel is the slug's product source mounted as a pixel field
    // (ADR-0020). Reduced motion must freeze it, exactly as it freezes the
    // hero field above.
    const [a, b] = await sampleTwice(page, '.px-reel .px-reel-field');
    expect(a).toBe(b);
  });

  test('a case-study reel field animates when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/work/vericite');

    // The control: the same field, motion allowed. If this ever freezes the
    // two reduced-motion assertions above prove nothing.
    const [a, b] = await sampleTwice(page, '.px-reel .px-reel-field');
    expect(a).not.toBe(b);
  });

  test('ship it advances one fixed step under the OS preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#shipit');

    const section = page.locator('#shipit');
    const canvas = page.getByRole('img', {
      name: 'Ship It maze — a blinking cursor eats code characters while four bugs give chase',
    });
    await section.getByRole('button', { name: 'Start shipping' }).click();
    const initialPixels = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());

    // Facing the wall above the spawn, UP is held but nothing moves.
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
      .toBe(initialPixels);
    await expect(shipitStatus(page, 'Score')).toHaveText('0');

    await page.keyboard.press('ArrowRight');
    const firstStepPixels = await canvas.evaluate((element: HTMLCanvasElement) =>
      element.toDataURL(),
    );
    expect(firstStepPixels).not.toBe(initialPixels);
    // Exactly one fixed step: half a second later nothing has moved again.
    await page.waitForTimeout(500);
    const settledPixels = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
    expect(settledPixels).toBe(firstStepPixels);
  });

  test('the site motion veto gives ship it the same discrete contract', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/#shipit');
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'off'));

    const section = page.locator('#shipit');
    await section.getByRole('button', { name: 'Start shipping' }).click();
    const before = Number(await shipitStatus(page, 'Score').textContent());
    await page.keyboard.press('ArrowRight');
    const afterOne = Number(await shipitStatus(page, 'Score').textContent());
    expect(afterOne).toBeGreaterThanOrEqual(before);
    await page.waitForTimeout(500);
    expect(Number(await shipitStatus(page, 'Score').textContent())).toBe(afterOne);

    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'on'));
  });
});
