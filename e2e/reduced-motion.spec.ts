import { expect, test, type Page } from '@playwright/test';

const DESKTOP_MIN_WIDTH = 861;
const RENDERER_ATTRIBUTE = 'data-wanderer-renderer';

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
    const sceneResources = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => /WandererCrane/i.test(decodeURIComponent(entry.name)))
        .map((entry) => ({
          name: entry.name,
          encodedBodySize: (entry as PerformanceResourceTiming).encodedBodySize,
        })),
    );
    // Turbopack may preload a sub-kilobyte async-loader manifest. The actual
    // Wanderer scene chunks (~24 KiB before shared Three.js) must remain gated.
    expect(sceneResources.reduce((total, entry) => total + entry.encodedBodySize, 0)).toBeLessThan(
      5_000,
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
