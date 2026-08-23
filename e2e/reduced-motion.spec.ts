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
 * should not pay for media they will never see. Case-study reels and writing
 * posts are pixel fields now (ADR-0020), so that half is structural: a field
 * ships zero media requests for anyone. `/work/neev` and `/writing/ai-for-msme`
 * both assert the empty request list. What reduced motion changes for a field
 * is that it must hold still — same sampling technique as the hero specs, on
 * the reel and on the writing RouteField.

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

function arcadeStatus(page: Page, label: string) {
  return page
    .locator('#arcade .px-arcade-status > div')
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

  test('a motion-disabled visitor is sent no media bytes on a writing post', async ({ page }) => {
    const mediaRequests: string[] = [];
    page.on('request', (r) => {
      if (/\.(mp4|webm|webp)(\?|$)/.test(r.url())) mediaRequests.push(r.url());
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/writing/ai-for-msme');
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

  test('the arcade advances one measured turn under the OS preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#arcade');

    const section = page.locator('#arcade');
    const canvas = page.getByRole('img', { name: 'Interactive asymmetric survey field' });
    await section.getByRole('button', { name: 'Start survey' }).click();
    const initialPixels = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());

    await page.keyboard.press('ArrowUp');
    await expect(arcadeStatus(page, 'Score')).toHaveText('0');
    await expect
      .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
      .toBe(initialPixels);

    await page.keyboard.press('ArrowRight');
    await expect(arcadeStatus(page, 'Score')).toHaveText('10');
    const firstTurnPixels = await canvas.evaluate((element: HTMLCanvasElement) =>
      element.toDataURL(),
    );
    expect(firstTurnPixels).not.toBe(initialPixels);
    await page.waitForTimeout(500);
    await expect(arcadeStatus(page, 'Score')).toHaveText('10');
    await expect
      .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
      .toBe(firstTurnPixels);

    await page.keyboard.press('ArrowRight');
    await expect(arcadeStatus(page, 'Score')).toHaveText('20');
    await expect
      .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
      .not.toBe(firstTurnPixels);
  });

  test('the site motion veto gives the arcade the same discrete contract', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/#arcade');
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'off'));

    const section = page.locator('#arcade');
    await section.getByRole('button', { name: 'Start survey' }).click();
    await page.keyboard.press('ArrowRight');
    await expect(arcadeStatus(page, 'Score')).toHaveText('10');
    await page.waitForTimeout(500);
    await expect(arcadeStatus(page, 'Score')).toHaveText('10');

    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'on'));
    await expect.poll(async () => Number(await arcadeStatus(page, 'Score').textContent())).toBe(40);
  });
});
