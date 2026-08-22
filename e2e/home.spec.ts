import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Home page', () => {
  test('all eight sections render', async ({ page }) => {
    await page.goto('/');

    // Pixel hero is `section.px-hero-block` (was `section.hero` in parchment).
    // Same live hero section, class renamed — selector migrated, assertion strength preserved.
    await expect(page.locator('section.px-hero-block')).toBeVisible();

    // Baseline eight: hero + #about, #work, #writing, #services, #process, #open, #contact.
    // Pixel renames: #about → #profile, #process → #method. #experience is additive in pixel
    // (Experience section) and is intentionally not asserted here — it is new markup, not baseline contract.
    // Regressions retained: original selectors `section.hero`, `#about`, and `#process` no longer match pixel
    // markup (renamed to `.px-hero-block`, `#profile`, `#method`). Migrated selectors find the same live
    // sections under their pixel ids; the original anchors are documented as missing.
    const sectionIds = [
      '#profile',
      '#work',
      '#writing',
      '#services',
      '#method',
      '#open',
      '#contact',
    ];

    // Individual presence checks, not an exact count — preserves baseline granularity and avoids failing
    // on additive #experience or future additive sections.
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
    // Baseline semantics: nav contains a list with six items and six links.
    // Regression: pixel `SiteNav` renders bare `<a>` children inside `<nav>` with no `<ul>/<li>`.
    // These expectations are retained as the baseline semantic contract and document that pixel removed
    // list/listitem semantics (will fail on pixel until list semantics are restored).
    await expect(nav.getByRole('list')).toHaveCount(1);
    await expect(nav.getByRole('listitem')).toHaveCount(6);
    await expect(nav.getByRole('link')).toHaveCount(6);

    const contactLink = nav.getByRole('link', { name: 'Contact', exact: true });
    await contactLink.focus();
    // `toBeFocused` asserts programmatic focus; visible focus ring is supplied by global `:focus-visible`
    // styles and is not asserted here as an outline property — narrowed claim per review finding.
    await expect(contactLink).toBeFocused();
    // `toBeInViewport` confirms the focused link is not off-screen; it does not assert focus-ring visibility.
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

      // Baseline nav anchors all hash to home sections; Writing → #writing is the anchor scroll contract.
      // Regression: pixel SiteNav maps Writing to `/writing/` (full page), not `/#writing`. The Work/Services/
      // Process/Open/Contact hashes still target home, but Writing via nav no longer hash-navigates; the
      // `#writing` section itself (`section#writing`) remains and is reachable via direct hash or scroll.
      // Also: pixel renames Process → Method (#process → #method) and About → Profile (#about → #profile);
      // the anchors array here is the baseline contract and documents those renames as missing original hashes.
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

      // Baseline geometry uses `.site-nav`, `.nav-links`, `.wordmark`, `.nav-meta`.
      // Regression: pixel header uses `.px-header`, `.px-wordmark`, `.px-nav`, `.px-header-end` with no
      // `.nav-links` or `.nav-meta`. This expectation is retained as baseline contract and documents the
      // pixel class rename / structure removal.
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

    // Baseline marquee is `.hero-marquee` with text names (React 19, Three.js, etc.).
    // Regression: pixel marquee is a decorative `<canvas class="px-marquee" aria-hidden="true">` in the
    // footer with no DOM text. This expectation is retained as baseline textual contract and documents
    // that pixel removed the technology-name text layer.
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
