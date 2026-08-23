import { expect, test, type Locator, type Page } from '@playwright/test';

const COLLISION_ROUTE = [
  'right',
  'right',
  'right',
  'right',
  'down',
  'down',
  ...Array.from({ length: 37 }, (_, index) => (index % 2 === 0 ? 'left' : 'right')),
] as const;

function status(section: Locator, label: string): Locator {
  return section.locator('.px-arcade-status > div').filter({ hasText: label }).locator('dd');
}

async function playCollisionRoute(page: Page, repeats = 1): Promise<void> {
  await page.evaluate(
    ({ route, repeatCount }) => {
      for (let repeat = 0; repeat < repeatCount; repeat++) {
        for (const direction of route) {
          const label = `move ${direction}`;
          const button = [...document.querySelectorAll<HTMLButtonElement>('#arcade button')].find(
            (candidate) => candidate.getAttribute('aria-label')?.toLowerCase() === label,
          );
          button?.click();
        }
      }
    },
    { route: COLLISION_ROUTE, repeatCount: repeats },
  );
}

test.describe('Arcade field', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#arcade', { waitUntil: 'domcontentloaded' });
    const canvas = page.getByRole('img', { name: 'Interactive asymmetric survey field' });
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.height)).not.toBe(150);
  });

  test('exposes a named field, DOM state and focus-scoped keyboard play', async ({
    isMobile,
    page,
  }) => {
    const section = page.locator('#arcade');
    const canvas = page.getByRole('img', { name: 'Interactive asymmetric survey field' });

    await expect(section.getByRole('heading', { level: 2 })).toHaveText(
      'A field that only resolves when you move through it.',
    );
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute(
      'aria-describedby',
      'arcade-objective arcade-controls-note arcade-legend',
    );
    await expect(section.getByText('Bracket', { exact: true })).toBeVisible();
    await expect(section.getByText('Direct follows your cell', { exact: false })).toBeVisible();
    await expect(status(section, 'Score')).toHaveText('0');
    await expect(status(section, 'Lives')).toHaveText('3');
    await expect(status(section, 'Readings')).toHaveText('0/199');
    await expect(status(section, 'State')).toHaveText('Ready');

    await section.getByRole('button', { name: 'Start survey' }).click();
    await expect(canvas).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(status(section, 'Score')).toHaveText('10');
    await expect(status(section, 'Readings')).toHaveText('1/199');
    await expect(status(section, 'State')).toHaveText('Survey active');
    await expect(section.locator('[aria-live="polite"]')).toHaveText(/Survey started/);

    if (!isMobile) {
      await page.keyboard.press('Tab');
      await expect(section.getByRole('button', { name: 'Toggle arcade sound' })).toBeFocused();
    }
  });

  test('routes visible buttons and swipes through one run without theme reset', async ({ page }) => {
    const section = page.locator('#arcade');
    const canvas = page.getByRole('img', { name: 'Interactive asymmetric survey field' });
    const sound = section.getByRole('button', { name: 'Toggle arcade sound' });

    await section.getByRole('button', { name: 'Start survey' }).click();
    await section.getByRole('button', { name: 'Move right' }).click();
    await expect(status(section, 'Score')).toHaveText('10');

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.3, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.5, { steps: 6 });
    await page.mouse.up();
    await expect(status(section, 'Score')).toHaveText('20');
    await expect(status(section, 'Lives')).toHaveText('3');

    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('abhishek.portfolio.arcade.sound')))
      .toBe('on');

    const stateBefore = await section.locator('.px-arcade-status').textContent();
    const pixelsBefore = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
    await page.getByRole('button', { name: 'Switch between day and night' }).click();
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(
      pixelsBefore,
    );
    await expect(section.locator('.px-arcade-status')).toHaveText(stateBefore ?? '');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Toggle arcade sound' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('presents contact, loss and exact restart state', async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium', 'The deterministic authored route needs one browser engine.');
    const section = page.locator('#arcade');
    await section.getByRole('button', { name: 'Start survey' }).click();

    await playCollisionRoute(page);
    await expect(status(section, 'Lives')).toHaveText('2');
    await expect(status(section, 'State')).toHaveText('Survey active');
    await expect(section.locator('[aria-live="polite"]')).toHaveText(
      'Contact. 2 lives remaining.',
    );

    await playCollisionRoute(page, 2);

    await expect(status(section, 'Lives')).toHaveText('0');
    await expect(status(section, 'Score')).toHaveText('70');
    await expect(status(section, 'State')).toHaveText('Run ended');
    await expect(section.locator('[aria-live="polite"]')).toHaveText('Run ended. Final score 70.');

    const restart = section.getByRole('button', { name: 'Restart survey' });
    await expect(restart).toBeVisible();
    await restart.click();
    await expect(status(section, 'Lives')).toHaveText('3');
    await expect(status(section, 'Score')).toHaveText('0');
    await expect(status(section, 'Readings')).toHaveText('0/199');
    await expect(status(section, 'State')).toHaveText('Survey active');
    await expect(page.getByRole('img', { name: 'Interactive asymmetric survey field' })).toBeFocused();
  });

  test('keeps the page on-width with 44px direction controls', async ({ page }) => {
    const section = page.locator('#arcade');
    const controls = section.locator('.px-arcade-direction');
    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBe(geometry.documentWidth);

    const count = await controls.count();
    expect(count).toBe(4);
    for (let index = 0; index < count; index++) {
      const box = await controls.nth(index).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('remounts a clean run without stale ownership', async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium', 'One engine is sufficient for remount ownership.');
    const section = page.locator('#arcade');
    await section.getByRole('button', { name: 'Start survey' }).click();
    await page.keyboard.press('ArrowRight');
    await expect(status(section, 'Score')).toHaveText('10');
    await page.goto('/writing', { waitUntil: 'domcontentloaded' });
    await page.goBack({ waitUntil: 'domcontentloaded' });

    const remounted = page.locator('#arcade');
    const remountedCanvas = page.getByRole('img', { name: 'Interactive asymmetric survey field' });
    await expect
      .poll(() => remountedCanvas.evaluate((element: HTMLCanvasElement) => element.height))
      .not.toBe(150);
    await remounted.getByRole('button', { name: 'Start survey' }).click();
    await page.keyboard.press('ArrowRight');
    await expect(status(remounted, 'Score')).toHaveText('10');
    await expect(status(remounted, 'Lives')).toHaveText('3');
  });
});
