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
    // Six links in a list, so a screen reader announces how many there are.
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

      // The header is the pixel one: wordmark on the left, nav in the middle,
      // theme switch on the right. The claim is unchanged — at the widths
      // where the row is tightest, nothing sits on top of anything else.
      const geometry = await page.locator('.px-header').evaluate((header) => {
        const rect = (sel: string) => header.querySelector(sel)?.getBoundingClientRect();
        const links = rect('.px-nav');
        const wordmark = rect('.px-wordmark');
        // The theme switch, not `.px-header-end` — the nav lives *inside*
        // `.px-header-end`, so comparing the two always overlaps and proves
        // nothing. The switch is the nav's actual sibling in that row.
        const end = rect('.px-theme-switch');
        if (!links || !wordmark || !end) throw new Error('missing navigation geometry');
        const overlaps = (a: DOMRect, b: DOMRect) =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        return {
          linksWordmark: overlaps(links, wordmark),
          linksEnd: overlaps(links, end),
        };
      });

      expect(geometry).toEqual({ linksWordmark: false, linksEnd: false });
    }
  });

  test('the page never advertises a dependency the site no longer has', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // The old CSS marquee listed the stack by name and this test policed that
    // list. The marquee is a decorative canvas of slogans now, with no DOM
    // text — but the claim it was really making still matters, and applies to
    // the whole page rather than one strip: do not name something that was
    // removed. `three` went with the Wanderer, and framer-motion, gsap and
    // lucide-react were dropped on 2026-05-19 (see CLAUDE.md).
    const body = page.locator('body');
    for (const gone of ['Three.js', 'Framer Motion', 'framer-motion', 'GSAP', 'lucide', 'shadcn', 'r3f']) {
      await expect(body, `home page still names the removed ${gone}`).not.toContainText(gone);
    }
  });

  // Live gate: 0 violations against wcag2a/wcag2aa/wcag21a/wcag21aa as of
  // the T5 audit remediation pass. The `continue-on-error` on the
  // corresponding Axe-core step in .github/workflows/lighthouse.yml has
  // been removed to match — this test failing now fails CI.
  test('axe-core reports no WCAG A/AA violations on the landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // The hero copy fades in, and axe measures the composited colour of
    // whatever frame it lands on. Mid-fade it reads `.px-hero-sub` at 4.47:1
    // and `.px-hero-note p` at 2.71:1; both clear 4.5:1 once the fade is done,
    // which is the state a reader actually reads. Measure that state — the
    // alternative is a test that fails on timing rather than on contrast.
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
