import { expect, test } from '@playwright/test';

// Status surfaces — 404 (not-found.tsx) and error boundary (error.tsx).
// Pixel `not-found.tsx` and `error.tsx` both render `StatusField` (decorative hero-scale canvas)
// plus a headed message and a way back. The 404 is reachable via any unknown path and returns
// a real 404 status (Next.js `notFound()` / file-system miss). The error boundary has no
// deterministic production trigger in current source (no query param or throw path), so it is
// documented via `fixme` rather than a synthetic route — creating a test-only throwing route would
// be a test-only production route, which is prohibited.

test.describe.configure({ mode: 'serial' });

test.describe('status surfaces', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Status surfaces are server-rendered; one engine is enough.',
  );

  test('404 returns 404 and renders the not-found surface', async ({ page, request }) => {
    // Request-level: unknown path returns real 404, not a 200 shell.
    const req = await request.get('/this-route-does-not-exist-404');
    expect(req.status()).toBe(404);

    // Page-level: Next.js renders app/not-found.tsx for that 404.
    const response = await page.goto('/this-route-does-not-exist-404');
    expect(response?.status()).toBe(404);

    // Heading: `SectionHead as="h1" label="404" heading="Page not found."` → level 1.
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found.' })).toBeVisible();
    // Narrow claim: visible heading text only, not emoji or decorative glyph coverage.
    await expect(page.locator('.px-status-copy')).toHaveText('This page does not exist.');
    // Narrow claim: copy asserts exact string, not that fixme proves execution.

    // Decorative canvas: `StatusField` → `PixelField variant="not-found"` renders a `canvas.px-status-field`
    // with `aria-hidden="true"` because the surrounding copy already states the status.
    // `.px-status-field` is the canvas itself, not a wrapper around one.
    const canvas = page.locator('canvas.px-status-field');
    await expect(canvas).toBeAttached();
    // A field with no label is decoration; the copy beside it already states
    // the status, so a screen reader should skip it.
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    // Decorative canvas never takes focus, even if somehow focused programmatically.
    await expect(canvas).not.toBeFocused();

    // Home action: primary way back to `/`.
    const homeLink = page.getByRole('link', { name: 'Go home', exact: true });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/');
    await expect(homeLink).toBeInViewport();
    // Focus check narrows claim to programmatic focusability, not visible ring assertion beyond global `:focus-visible`.
    await homeLink.focus();
    await expect(homeLink).toBeFocused();
  });

  // Error boundary — no safe deterministic trigger in current source.
  // `app/error.tsx` is a client `error` boundary requiring a thrown error in the segment. The app's
  // `work/[slug]/page.tsx` and `writing/[slug]/page.tsx` call `notFound()` on missing slugs, not `throw`,
  // and no existing route or query param deterministically throws. A fixme is used instead of a synthetic
  // throwing route: that route would be test-only production code, which the brief prohibits, and a
  // negative-control page that never throws would be a false-positive `fixme`.
  test.fixme(
    'error boundary renders Something failed. with Try again and Go home — no deterministic trigger in source',
    async () => {
      // Intentionally not executed. Documents that `app/error.tsx` exists with:
      //   h1 "Something failed." (label "Error"), copy "This page could not be rendered.",
      //   `canvas.px-status-field[aria-hidden="true"]` (StatusField variant="error"),
      //   button "Try again" (calls `reset()`) and link "Go home" (href="/").
      // No current source route throws deterministically; adding `app/__error-test/throw` would be a
      // test-only production route. Keep fixme until a real user-reachable throw path is introduced
      // (e.g., a search param that the segment validates and throws on), then replace with a live
      // `page.goto` + `expect 500 → error surface` + `reset` round-trip.
    },
  );
});
