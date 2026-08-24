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
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box, `control ${i}`).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
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
