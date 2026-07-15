import { expect, test, type Page, type Response } from '@playwright/test';

const DESKTOP_MIN_WIDTH = 861;
const RENDERER_ATTRIBUTE = 'data-wanderer-renderer';
const SCENE_RESOURCE_MARKERS = [RENDERER_ATTRIBUTE, 'data-wanderer-pose', 'companion-svg'] as const;

function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;
}

async function expectWandererAbsent(page: Page) {
  const companion = page.locator('#companion');

  await expect(companion).toBeAttached();
  await expect(companion).toBeHidden();
  await expect(companion.locator('canvas')).toHaveCount(0);
  await expect.poll(() => companion.getAttribute(RENDERER_ATTRIBUTE)).toBeNull();
}

async function expectWandererReady(page: Page) {
  const companion = page.locator('#companion');

  await expect(companion).toBeVisible();
  await expect(companion).toHaveAttribute(RENDERER_ATTRIBUTE, 'canvas', {
    timeout: 30_000,
  });
  await expect(companion.locator('canvas')).toBeVisible();
}

async function identifyTransferredSceneResource(page: Page): Promise<string> {
  const scriptResponses: Response[] = [];
  page.on('response', (response) => {
    if (response.ok() && response.request().resourceType() === 'script') {
      scriptResponses.push(response);
    }
  });

  await page.goto('/');
  await expectWandererReady(page);
  await page.waitForLoadState('networkidle');

  // Production chunk names are hashes. Identify the lazy scene by the stable
  // runtime contracts it ships instead of a source-module label.
  const candidates = (
    await Promise.all(
      scriptResponses.map(async (response) => ({
        response,
        source: await response.text(),
      })),
    )
  ).filter(({ source }) => SCENE_RESOURCE_MARKERS.every((marker) => source.includes(marker)));

  expect(candidates, 'expected exactly one transferred lazy scene resource').toHaveLength(1);
  const sceneResourceUrl = candidates[0]!.response.url();
  const timing = await page.evaluate((resourceUrl) => {
    const entry = performance.getEntriesByName(resourceUrl, 'resource')[0] as
      PerformanceResourceTiming | undefined;
    return entry
      ? {
          encodedBodySize: entry.encodedBodySize,
          transferSize: entry.transferSize,
        }
      : null;
  }, sceneResourceUrl);

  expect(timing, `missing resource timing for ${sceneResourceUrl}`).not.toBeNull();
  expect(timing?.encodedBodySize ?? 0).toBeGreaterThan(0);
  expect(timing?.transferSize ?? 0).toBeGreaterThan(0);
  return sceneResourceUrl;
}

test.describe('prefers-reduced-motion', () => {
  test('marquee track has no running animation when user prefers reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const track = page.locator('.hero-marquee .marquee-track').first();
    await expect(track).toBeVisible();

    const { animationName, animationPlayState } = await track.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        animationName: cs.animationName,
        animationPlayState: cs.animationPlayState,
      };
    });

    expect(
      animationName === 'none' || animationPlayState === 'paused',
      `expected marquee paused under reduced-motion, got animation-name="${animationName}" play-state="${animationPlayState}"`,
    ).toBe(true);
  });

  test('the entire Wanderer is absent for reduced motion', async ({ page }) => {
    test.skip(!isDesktop(page), 'Mobile absence is covered in canvas.spec.ts.');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectWandererAbsent(page);
  });

  test('the entire Wanderer is absent when motion is off before hydration', async ({ page }) => {
    test.skip(!isDesktop(page), 'Mobile absence is covered in canvas.spec.ts.');

    await page.addInitScript(() => {
      localStorage.setItem('dl-tweaks-v1', JSON.stringify({ motion: 'off' }));
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    await expectWandererAbsent(page);
  });

  test('the lazy scene resource stays behind every initial-load gate', async ({
    baseURL,
    browser,
    browserName,
    page,
  }) => {
    test.slow();
    test.skip(
      browserName !== 'chromium' || !isDesktop(page),
      'The positive resource-transfer control is Chromium-desktop scoped.',
    );
    if (!baseURL) throw new Error('Playwright baseURL is required for isolated gate contexts.');

    const sceneResourceUrl = await identifyTransferredSceneResource(page);
    const gates: Array<{
      name: 'route' | 'breakpoint' | 'reduced-motion' | 'stored-motion-off';
      path: string;
      viewport: { width: number; height: number };
      reducedMotion?: 'no-preference' | 'reduce';
      storedMotionOff?: boolean;
    }> = [
      {
        name: 'route',
        path: '/work/neev',
        viewport: { width: 1440, height: 900 },
      },
      {
        name: 'breakpoint',
        path: '/',
        viewport: { width: DESKTOP_MIN_WIDTH - 1, height: 900 },
      },
      {
        name: 'reduced-motion',
        path: '/',
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      },
      {
        name: 'stored-motion-off',
        path: '/',
        viewport: { width: 1440, height: 900 },
        storedMotionOff: true,
      },
    ];

    await Promise.all(
      gates.map(async (gate) => {
        const context = await browser.newContext({
          baseURL,
          reducedMotion: gate.reducedMotion ?? 'no-preference',
          viewport: gate.viewport,
        });
        const gatedPage = await context.newPage();
        const exactResourceRequests: string[] = [];
        gatedPage.on('request', (request) => {
          if (request.url() === sceneResourceUrl) exactResourceRequests.push(request.url());
        });

        if (gate.storedMotionOff) {
          await gatedPage.addInitScript(() => {
            localStorage.setItem('dl-tweaks-v1', JSON.stringify({ motion: 'off' }));
          });
        }

        try {
          const response = await gatedPage.goto(gate.path);
          expect(response?.status(), `${gate.name} gate navigation failed`).toBe(200);
          await gatedPage.waitForLoadState('networkidle');
          await expectWandererAbsent(gatedPage);

          if (gate.name === 'route') {
            await expect(gatedPage).toHaveURL(/\/work\/neev$/);
          } else if (gate.name === 'breakpoint') {
            expect(await gatedPage.evaluate(() => window.innerWidth)).toBe(DESKTOP_MIN_WIDTH - 1);
          } else if (gate.name === 'reduced-motion') {
            expect(
              await gatedPage.evaluate(
                () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
              ),
            ).toBe(true);
          } else {
            await expect(gatedPage.locator('html')).toHaveAttribute('data-motion', 'off');
          }

          const exactResourceTimings = await gatedPage.evaluate(
            (resourceUrl) => performance.getEntriesByName(resourceUrl, 'resource').length,
            sceneResourceUrl,
          );
          expect(exactResourceRequests, `${gate.name} gate requested ${sceneResourceUrl}`).toEqual(
            [],
          );
          expect(exactResourceTimings, `${gate.name} gate transferred ${sceneResourceUrl}`).toBe(0);
        } finally {
          await context.close();
        }
      }),
    );
  });

  test('runtime motion policy changes tear down and restore Wanderer', async ({
    browserName,
    page,
  }) => {
    test.slow();
    test.skip(
      browserName !== 'chromium' || !isDesktop(page),
      'One desktop engine is sufficient for live policy transitions.',
    );

    await page.goto('/');
    await expectWandererReady(page);

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-motion', 'off');
    });
    await expectWandererAbsent(page);

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-motion', 'on');
    });
    await expectWandererReady(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expectWandererAbsent(page);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expectWandererReady(page);
  });
});
