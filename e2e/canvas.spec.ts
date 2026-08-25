import { expect, test, type Page } from '@playwright/test';

/**
 * The pixel canvases.
 *
 * This file used to test the Three.js Wanderer and the `.scene-frame` host.
 * Both were deleted with the parchment design; the specs were kept "as the
 * baseline behavioural contract" and were therefore permanently red. A suite
 * that is known-red tests nothing, so they are gone and this covers what is
 * actually on the page.
 *
 * Everything here is user-visible: a canvas that mounted and was sized by the
 * engine, a decorative canvas that screen readers skip, a meaningful one that
 * they do not, and a portrait that swaps to the photograph on click. No engine
 * internals, no frame counting — a blend needs dozens of consecutive frames and
 * asserting on one of them is how this suite gets flaky.
 */
test.describe.configure({ timeout: 60_000 });

/**
 * A mounted field has a backing store the engine sized from the element's box
 * and the device pixel ratio. An unmounted canvas keeps the HTML default of
 * 300×150, so this distinguishes "the engine ran" from "the markup exists",
 * which is the only distinction worth making here.
 */
async function expectFieldMounted(page: Page, selector: string) {
  const canvas = page.locator(selector).first();
  await expect(canvas).toBeAttached();
  await expect
    .poll(
      async () =>
        canvas.evaluate((c: HTMLCanvasElement) => `${c.width}x${c.height}`),
      { timeout: 20_000 },
    )
    .not.toBe('300x150');
}

test.describe('pixel canvases', () => {
  test('the hero field mounts and is sized by the engine', async ({ page }) => {
    await page.goto('/');
    await expectFieldMounted(page, '.px-heatfield canvas');
  });

  test('decorative canvases are hidden from screen readers', async ({ page }) => {
    await page.goto('/');

    for (const selector of ['.px-marquee', '.px-skyline', '.px-portrait-canvas']) {
      await expect(page.locator(selector).first()).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('the method band is announced, because it carries meaning', async ({ page }) => {
    await page.goto('/');

    // The four stage tiles are decoration around it; the band itself is the
    // content, so it is the one canvas with a role and a name.
    const band = page.locator('canvas.px-pipeline-band');
    await expect(band).toHaveAttribute('role', 'img');
    await expect(band).toHaveAttribute('aria-label', /method/i);
    await expect(page.locator('canvas.px-pipeline-tile-canvas').first()).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('the portrait swaps to the photograph and back', async ({ page }) => {
    await page.goto('/');

    const toggle = page.locator('.px-portrait-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.px-portrait-photo')).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('fields remount after a client-side navigation away and back', async ({ page }) => {
    await page.goto('/');
    await expectFieldMounted(page, '.px-heatfield canvas');

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Writing' }).click();
    await page.waitForURL('**/writing');
    await expect(page.locator('.px-heatfield canvas')).toHaveCount(0);

    await page.goBack();
    await page.waitForURL((url) => url.pathname === '/');
    // The disposer has to have run and the effect re-mounted; a leaked loop or
    // a dead canvas both show up here.
    await expectFieldMounted(page, '.px-heatfield canvas');
  });

  test('writing details keep their single route field', async ({ page }) => {
    await page.goto('/writing/ai-for-msme');
    await expect(page.locator('.px-article .px-route-field')).toHaveCount(1);
    await expect(page.locator('.px-article .px-reel-field')).toHaveCount(0);
    await expectFieldMounted(page, '.px-article .px-route-field');
  });

  // D3: the prose column keeps its readable measure while non-prose blocks
  // break out into the article gutters. The first attempt styled only a
  // max-width, which is inert against an auto-width block, so the geometry
  // here is what separates the shipped feature from that no-op.
  test('code breaks out wider than the prose column without overflowing', async ({ page }) => {
    await page.setViewportSize({ width: 2294, height: 1200 });
    await page.goto('/writing/native-git-hooks-for-non-node');

    // The post's fences are language-tagged, so every pre sits inside a
    // rehype-pretty-code figure; assert through the wrapper, not bare pre.
    const figure = page
      .locator('.px-article-body figure[data-rehype-pretty-code-figure]')
      .first();
    await expect(figure).toBeVisible();

    const widths = await page.evaluate(() => {
      const body = document.querySelector('.px-article-body')?.getBoundingClientRect();
      const breakout = document
        .querySelector('.px-article-body figure[data-rehype-pretty-code-figure]')
        ?.getBoundingClientRect();
      const shell = document.querySelector('.px-article')?.getBoundingClientRect();
      if (!body || !breakout || !shell) throw new Error('missing breakout geometry');
      return { body: body.width, breakout: breakout.width, shell: shell.width };
    });
    // Strictly wider than the prose column when the gutters have room...
    expect(widths.breakout).toBeGreaterThan(widths.body);
    // ...yet never wider than the article shell it lives in.
    expect(widths.breakout).toBeLessThanOrEqual(widths.shell);

    // The same track must not open horizontal overflow at phone width.
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.px-article-body')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });

  test('the status field mounts on the 404 route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expectFieldMounted(page, 'canvas.px-status-field');
  });
});
