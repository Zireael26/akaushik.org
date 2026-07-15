import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Home page', () => {
  test('all eight sections render', async ({ page }) => {
    await page.goto('/');

    // Hero has class `.hero` (no id — the wordmark anchor uses #top as the
    // back-to-top target). The other seven have stable section ids.
    await expect(page.locator('section.hero')).toBeVisible();

    const sectionIds = [
      '#about',
      '#work',
      '#writing',
      '#services',
      '#process',
      '#open',
      '#contact',
    ];

    for (const id of sectionIds) {
      await expect(page.locator(id)).toBeVisible();
    }
  });

  test('primary navigation stays semantic and usable at every viewport', async ({
    page,
    viewport,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('list')).toHaveCount(1);
    await expect(nav.getByRole('listitem')).toHaveCount(6);
    await expect(nav.getByRole('link')).toHaveCount(6);

    const contactLink = nav.getByRole('link', { name: 'Contact', exact: true });
    await contactLink.focus();
    await expect(contactLink).toBeFocused();
    await expect(contactLink).toBeInViewport();

    if (viewport && viewport.width <= 1000) {
      const treatment = await nav.evaluate((element) => {
        const navRect = element.getBoundingClientRect();
        const wordmarkRect = document.querySelector('.wordmark')?.getBoundingClientRect();
        const linkRect = element.querySelector('a')?.getBoundingClientRect();
        return {
          overflowX: getComputedStyle(element).overflowX,
          startsBelowWordmark: wordmarkRect ? navRect.top >= wordmarkRect.bottom : false,
          touchTargetHeight: linkRect?.height ?? 0,
        };
      });

      expect(treatment).toEqual({
        overflowX: 'auto',
        startsBelowWordmark: true,
        touchTargetHeight: 44,
      });

      const anchors = [
        ['Work', 'work'],
        ['Writing', 'writing'],
        ['Services', 'services'],
        ['Process', 'process'],
        ['Open', 'open'],
        ['Contact', 'contact'],
      ] as const;

      for (const [name, id] of anchors) {
        await nav.getByRole('link', { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));

        const targetGap = async () =>
          page.locator(`#${id}`).evaluate(
            (target) =>
              target.getBoundingClientRect().top -
              (document.querySelector('.site-nav')?.getBoundingClientRect().bottom ?? 0),
          );
        if (id !== 'contact') {
          await expect
            .poll(targetGap, {
              message: `${name} target should not leave a second header-sized blank offset`,
            })
            .toBeLessThanOrEqual(32);
        }
        expect(
          await targetGap(),
          `${name} target should clear the sticky mobile header`,
        ).toBeGreaterThanOrEqual(-1);
      }

      return;
    }

    await nav.getByRole('link', { name: 'Work', exact: true }).click();

    await expect(page).toHaveURL(/#work$/);
    const work = page.locator('#work');
    await expect(work).toBeInViewport({ ratio: 0.1 });
  });

  test('intermediate-width navigation has no wordmark or status collisions', async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== 'chromium', 'One engine is sufficient for breakpoint geometry.');

    for (const width of [861, 900]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const geometry = await page.locator('.site-nav').evaluate((nav) => {
        const links = nav.querySelector('.nav-links')?.getBoundingClientRect();
        const wordmark = nav.querySelector('.wordmark')?.getBoundingClientRect();
        const meta = nav.querySelector('.nav-meta')?.getBoundingClientRect();
        if (!links || !wordmark || !meta) throw new Error('missing navigation geometry');
        const overlaps = (a: DOMRect, b: DOMRect) =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        return {
          linksWordmark: overlaps(links, wordmark),
          linksMeta: overlaps(links, meta),
          overflowX: getComputedStyle(nav.querySelector('.nav-links') as Element).overflowX,
        };
      });

      expect(geometry).toEqual({
        linksWordmark: false,
        linksMeta: false,
        overflowX: 'auto',
      });
    }
  });

  test('technology marquee names only live technologies', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const marquee = page.locator('.hero-marquee');
    await expect(marquee).toContainText('React 19');
    await expect(marquee).toContainText('Three.js');
    await expect(marquee).not.toContainText('Framer Motion');
    await expect(marquee).not.toContainText('r3f');
    await expect(marquee).not.toContainText('shadcn');
  });

  // Live gate: 0 violations against wcag2a/wcag2aa/wcag21a/wcag21aa as of
  // the T5 audit remediation pass. The `continue-on-error` on the
  // corresponding Axe-core step in .github/workflows/lighthouse.yml has
  // been removed to match — this test failing now fails CI.
  test('axe-core reports no WCAG A/AA violations on the landing page', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
