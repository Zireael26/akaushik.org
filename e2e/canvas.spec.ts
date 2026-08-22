import { expect, test, type Page } from '@playwright/test';

// Baseline hero canvas + Wanderer (Three.js) contract — parchment era.
// Regression: pixel transplant removed the Three.js scene entirely:
// `.scene-frame`, `.scene-svg`, `.scene-canvas-host`, `[data-canvas-active]`, `#companion`,
// `.companion-svg`, `data-wanderer-renderer`, `data-wanderer-pose` are parchment markup.
// Pixel hero is `div.px-heatfield` → `canvas.px-heatfield` (PixelField) with no companion.
// These expectations are retained verbatim as the baseline behavioral contract and document
// that pixel removed the wanderer/scene-frame. They will fail on pixel until the scene contract
// is restored or the tests are intentionally migrated to the pixel field.

const DESKTOP_MIN_WIDTH = 861;
const RENDERER_ATTRIBUTE = 'data-wanderer-renderer';
const MAX_RENDER_PIXELS = 1920 * 1080;
const PIXEL_CAP_DPR = 2;
const PIXEL_CAP_VIEWPORT = { width: 1440, height: 900 };

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

  test('desktop Wanderer promotes its SVG floor and enforces the render-pixel cap', async ({
    baseURL,
    browser,
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium' || !isDesktop(page),
      'The positive WebGL renderer proof is Chromium-desktop scoped.',
    );
    if (!baseURL) throw new Error('Playwright baseURL is required for the DPR test context.');

    const runtimeErrors: string[] = [];
    const renderContext = await browser.newContext({
      baseURL,
      deviceScaleFactor: PIXEL_CAP_DPR,
      viewport: PIXEL_CAP_VIEWPORT,
    });
    const renderPage = await renderContext.newPage();
    renderPage.on('pageerror', (error) => runtimeErrors.push(error.message));
    renderPage.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    try {
      await renderPage.goto('/');
      await expectWandererCanvas(renderPage);
      const renderMetrics = await renderPage.locator('#companion canvas').evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const viewportPixels = window.innerWidth * window.innerHeight;
        return {
          actualPixels: canvas.width * canvas.height,
          devicePixelRatio: window.devicePixelRatio,
          theoreticalPixels: viewportPixels * window.devicePixelRatio ** 2,
        };
      });

      expect(renderMetrics.devicePixelRatio).toBe(PIXEL_CAP_DPR);
      expect(renderMetrics.theoreticalPixels).toBeGreaterThan(MAX_RENDER_PIXELS);
      expect(renderMetrics.actualPixels).toBeGreaterThan(0);
      expect(renderMetrics.actualPixels).toBeLessThanOrEqual(MAX_RENDER_PIXELS);
      expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([]);
    } finally {
      await renderContext.close();
    }
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
