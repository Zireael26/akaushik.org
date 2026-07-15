import { expect, test, type Page } from '@playwright/test';

const DESKTOP_MIN_WIDTH = 861;
const RENDERER_ATTRIBUTE = 'data-wanderer-renderer';

function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;
}

async function expectWandererCanvas(page: Page) {
  const companion = page.locator('#companion');
  const svg = companion.locator('.companion-svg');

  await expect(companion).toBeVisible();
  await expect(svg).toBeAttached();
  await expect(companion).toHaveAttribute(RENDERER_ATTRIBUTE, 'canvas', {
    timeout: 30_000,
  });
  await expect(companion.locator('canvas')).toBeVisible();
  await expect(svg).toBeHidden();
}

async function expectWandererAbsent(page: Page) {
  const companion = page.locator('#companion');

  await expect(companion).toBeAttached();
  await expect(companion).toBeHidden();
  await expect(companion.locator('canvas')).toHaveCount(0);
  await expect.poll(() => companion.getAttribute(RENDERER_ATTRIBUTE)).toBeNull();
}

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.describe('hero canvas + wanderer', () => {
  test('scene frame renders its SVG fallback and canvas host', async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium', 'The hero Three.js smoke remains Chromium-scoped.');

    await page.goto('/');
    const sceneFrame = page.locator('.scene-frame');
    await expect(sceneFrame).toBeVisible();
    await expect(sceneFrame.locator('.scene-svg')).toBeAttached();
    await expect(sceneFrame.locator('.scene-canvas-host')).toBeAttached({
      timeout: 30_000,
    });
    await expect(sceneFrame).toHaveAttribute('data-canvas-active', 'true', {
      timeout: 30_000,
    });
  });

  test('desktop Wanderer promotes its SVG floor to a real canvas', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium' || !isDesktop(page),
      'The positive WebGL renderer proof is Chromium-desktop scoped.',
    );

    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    await page.goto('/');
    await expectWandererCanvas(page);
    const renderPixels = await page
      .locator('#companion canvas')
      .evaluate(
        (canvas) => (canvas as HTMLCanvasElement).width * (canvas as HTMLCanvasElement).height,
      );
    expect(renderPixels).toBeLessThanOrEqual(1920 * 1080);
    expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([]);
  });

  test('desktop Wanderer settles on its SVG fallback when WebGL is unavailable', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium' || !isDesktop(page),
      'The forced WebGL failure proof is Chromium-desktop scoped.',
    );

    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
          if (this.parentElement?.id === 'companion' && contextId.startsWith('webgl')) {
            const probe = window as unknown as { __wandererWebglAttempts?: number };
            probe.__wandererWebglAttempts = (probe.__wandererWebglAttempts ?? 0) + 1;
            return null;
          }
          return Reflect.apply(original, this, [contextId, ...args]);
        },
      });
    });

    await page.goto('/');
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __wandererWebglAttempts?: number }).__wandererWebglAttempts ??
              0,
          ),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    const companion = page.locator('#companion');
    await expect(companion).toHaveAttribute(RENDERER_ATTRIBUTE, 'fallback');
    await expect(companion.locator('canvas')).toHaveCount(0);
    await expect(companion.locator('.companion-svg')).toBeVisible();
  });

  test('Wanderer is absent outside the pose-driven home route', async ({ page }) => {
    test.skip(!isDesktop(page), 'Wanderer is already absent on narrow viewports.');

    const response = await page.goto('/work/neev');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Neev', exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectWandererAbsent(page);
  });

  test('client navigation tears down and restores the home-only scene', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium' || !isDesktop(page),
      'One desktop engine is sufficient for route lifecycle transitions.',
    );

    await page.goto('/');
    await expectWandererCanvas(page);

    await page.locator('#case-neev .case-link').click();
    await expect(page).toHaveURL(/\/work\/neev$/);
    await expectWandererAbsent(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expectWandererCanvas(page);
  });

  test('pose arbitration follows the most-visible home section', async ({ browserName, page }) => {
    test.skip(
      browserName !== 'chromium' || !isDesktop(page),
      'One desktop engine is sufficient for IntersectionObserver choreography.',
    );

    await page.goto('/');
    await expectWandererCanvas(page);
    await page.locator('#writing').scrollIntoViewIfNeeded();
    await expect(page.locator('#companion')).toHaveAttribute('data-wanderer-pose', 'writing');
  });

  test('Wanderer is absent below the desktop breakpoint', async ({ page }) => {
    test.skip(isDesktop(page), 'This assertion targets tablet and mobile.');

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectWandererAbsent(page);
  });

  test('crossing the desktop breakpoint tears down and restores Wanderer', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium' || !isDesktop(page),
      'One desktop engine is sufficient for the live viewport transition.',
    );

    await page.goto('/');
    await expectWandererCanvas(page);

    await page.setViewportSize({ width: DESKTOP_MIN_WIDTH - 1, height: 900 });
    await expectWandererAbsent(page);

    await page.setViewportSize({ width: DESKTOP_MIN_WIDTH, height: 900 });
    await expectWandererCanvas(page);
  });
});
