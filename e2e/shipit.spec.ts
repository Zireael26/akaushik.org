import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Browser interaction and accessibility contract for Ship It (SC7 / SC11).
 *
 * Movement, lifecycle, and reduced-motion mechanics live in their focused
 * sibling specs, where each can instrument the browser without weakening
 * these user-facing controls.
 */

async function startRun(page: Page) {
  const section = page.locator('#shipit');
  await section.scrollIntoViewIfNeeded();
  const canvas = section.getByRole('img', {
    name: 'Ship It maze — a blinking cursor eats code characters while four bugs give chase',
  });
  await expect
    .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
    .toBeGreaterThan(400);
  await section.getByRole('button', { name: 'Start shipping' }).click();
  await expect(status(page, 'State')).toHaveText('Shipping');
  return section;
}

function status(page: Page, label: string) {
  return page.locator('#shipit .px-shipit-status > div').filter({ hasText: label }).locator('dd');
}

/**
 * The bounding box of everything painted into the canvas, plus a lit-pixel
 * count, both in device pixels. Sampled on a stride so a 1580x1750 backing
 * store stays a fast evaluate; the defects this measures are whole-quadrant
 * and whole-path, not single pixels.
 */
async function inkExtent(canvas: ReturnType<Page['locator']>) {
  return canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    const data = ctx.getImageData(0, 0, el.width, el.height).data;
    const STRIDE = 2;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;
    let lit = 0;
    for (let y = 0; y < el.height; y += STRIDE) {
      for (let x = 0; x < el.width; x += STRIDE) {
        if ((data[(y * el.width + x) * 4 + 3] ?? 0) <= 8) continue;
        lit++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return {
      width: el.width,
      height: el.height,
      lit,
      spanX: maxX < 0 ? 0 : maxX - minX + STRIDE,
      spanY: maxY < 0 ? 0 : maxY - minY + STRIDE,
    };
  });
}

test.describe('Ship It', () => {
  test('starts from the button and accepts keyboard input', async ({ page }) => {
    await page.goto('/#shipit');
    const section = await startRun(page);

    const canvas = section.getByRole('img', {
      name: 'Ship It maze — a blinking cursor eats code characters while four bugs give chase',
    });
    await expect(canvas).toBeFocused();

    const before = Number(await status(page, 'Score').textContent());
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => Number(await status(page, 'Score').textContent()))
      .toBeGreaterThanOrEqual(before);
    await expect(status(page, 'State')).toHaveText('Shipping');
  });

  test('direction buttons move the caret', async ({ page }) => {
    await page.goto('/#shipit');
    const section = await startRun(page);
    const before = Number(await status(page, 'Score').textContent());
    await section.getByRole('button', { name: 'Move right' }).click();
    await expect
      .poll(async () => Number(await status(page, 'Score').textContent()))
      .toBeGreaterThanOrEqual(before);
  });

  test('a swipe on the canvas registers as input', async ({ page }) => {
    await page.goto('/#shipit');
    const section = await startRun(page);
    const canvas = section.getByRole('img', {
      name: 'Ship It maze — a blinking cursor eats code characters while four bugs give chase',
    });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const before = Number(await status(page, 'Score').textContent());
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 48, y, { steps: 4 });
    await page.mouse.up();
    await expect
      .poll(async () => Number(await status(page, 'Score').textContent()))
      .toBeGreaterThanOrEqual(before);
  });

  test('sound stays off until the control is pressed', async ({ page }) => {
    await page.goto('/#shipit');
    const section = page.locator('#shipit');
    await section.scrollIntoViewIfNeeded();
    const canvas = section.locator('.px-shipit-canvas');
    await expect
      .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
      .toBeGreaterThan(400);
    const sound = section.getByRole('button', { name: 'Toggle game sound' });
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await expect(sound).toHaveText('Sound off');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await expect(sound).toHaveText('Sound on');
  });

  test('the board does not trap focus', async ({ page }) => {
    await page.goto('/#shipit');
    const section = await startRun(page);
    const canvas = section.getByRole('img', {
      name: 'Ship It maze — a blinking cursor eats code characters while four bugs give chase',
    });
    await expect(canvas).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(canvas).not.toBeFocused();
  });

  test('the canvas follows the site theme', async ({ page }) => {
    await page.goto('/#shipit');
    const canvas = page.locator('#shipit .px-shipit-canvas');
    await canvas.scrollIntoViewIfNeeded();
    await expect
      .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
      .toBeGreaterThan(400);
    const light = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
    await page.evaluate(() => document.documentElement.setAttribute('data-mode', 'dark'));
    await expect
      .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL()))
      .not.toBe(light);
  });

  test('375px has no horizontal overflow and 44px controls', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/#shipit');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const buttons = page.locator('#shipit .px-shipit-action, #shipit .px-shipit-direction');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    // WCAG 2.5.5 is 44 *CSS* pixels, which is what shipit.css declares. A bare
    // `>= 44` on boundingBox is a stricter test than the rule: Firefox rounds
    // the box through device pixels and reports 43.99993896484375 for a
    // `min-height: 44px` control, so the assertion failed on a 6e-5 px
    // quantization artifact while the control was exactly the required size.
    // Half a device pixel of slack keeps a real 43px control failing.
    const TOUCH_TARGET_MIN = 44 - 0.5;
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box, `control ${i}`).not.toBeNull();
      expect(box!.height, `control ${i} height`).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
      expect(box!.width, `control ${i} width`).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
    }
  });

  test('axe reports no WCAG A/AA violations on the section', async ({ page }) => {
    await page.goto('/#shipit');
    const results = await new AxeBuilder({ page })
      .include('#shipit')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

/**
 * Two whole-canvas properties that every other Ship It assertion missed,
 * because each one looks at a locator, a status value, or a single frame —
 * and both of these defects are only visible in the pixels, over time.
 */
test.describe('Ship It canvas integrity', () => {
  // The board is drawn in CSS pixels. Assigning canvas.width/height resets the
  // context transform, so if the device-pixel scale is not reapplied on resize
  // the whole board lands in the top-left 1/dpr of the buffer. At dpr 1 that is
  // invisible, which is how it shipped; this pins dpr 2 for every project.
  test.use({ deviceScaleFactor: 2 });

  test('the board fills its canvas backing store, not one corner of it', async ({ page }) => {
    await page.goto('/#shipit');
    const section = page.locator('#shipit');
    await section.scrollIntoViewIfNeeded();
    const canvas = section.locator('canvas.px-shipit-canvas');
    await expect
      .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
      .toBeGreaterThan(400);

    const extent = await inkExtent(canvas);
    expect(extent.width, 'canvas is not scaled for this dpr').toBeGreaterThan(extent.height * 0.5);
    expect(
      extent.spanX / extent.width,
      `board spans ${extent.spanX} of ${extent.width} device px across`,
    ).toBeGreaterThan(0.95);
    expect(
      extent.spanY / extent.height,
      `board spans ${extent.spanY} of ${extent.height} device px down`,
    ).toBeGreaterThan(0.95);
  });

  test('a run leaves no trail — the frame is cleared, not painted over', async ({ page }) => {
    await page.goto('/#shipit');
    const section = await startRun(page);
    const canvas = section.locator('canvas.px-shipit-canvas');

    const before = await inkExtent(canvas);
    await canvas.click();
    const CIRCUIT = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'] as const;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(CIRCUIT[i % CIRCUIT.length]!);
      await page.waitForTimeout(220);
    }
    const after = await inkExtent(canvas);

    // Pellets are consumed as the run proceeds, so lit area should fall, never
    // climb. Without the per-frame clear the player's and ghosts' whole paths
    // stay painted and this only goes up. A little slack absorbs the caret
    // blink and the energizer pulse.
    expect(
      after.lit,
      `lit pixels went ${before.lit} -> ${after.lit}; a cleared frame cannot gain area while pellets are eaten`,
    ).toBeLessThan(before.lit * 1.02);
    expect(after.spanX / after.width).toBeGreaterThan(0.95);
  });
});
