import { expect, test } from '@playwright/test';

// Smoke test for the Phase-5 scene work: the hero agent-graph Three.js canvas
// + the Wanderer Three.js crane. Visual parity against the reference
// design is Abhishek's eyes (per plan §Final state + ADR-0005 follow-up);
// what this spec proves is that the canvas mounts, the SVG fallback is
// present for reduced-motion, and both scenes coexist without console
// errors blocking first paint.
//
// Scope kept narrow on purpose — the scenes are heavy, the assertions
// are shallow. WebGL doesn't render deterministically on Playwright
// headless in every environment, so we assert the DOM plumbing rather
// than pixel output.

test.describe.configure({ mode: 'serial' });

test.describe('hero canvas + wanderer', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Three.js stability varies by engine; chromium-desktop is the canonical surface for this spec.',
  );

  test('scene frame renders both SVG fallback and canvas host', async ({
    page,
  }) => {
    await page.goto('/');
    // SVG fallback ships on SSR, always attached. Once the Three.js canvas mounts,
    // AgentGraphClient flags the scene-frame with `data-canvas-active="true"`
    // and the SVG is hidden (display: none) so the two layers don't composite
    // through the transparent WebGL canvas — so assert presence, not paint.
    const sceneFrame = page.locator('.scene-frame');
    await expect(sceneFrame).toBeVisible();
    await expect(sceneFrame.locator('.scene-svg')).toBeAttached();
    // Canvas host is injected client-side by AgentGraphClient.
    await expect(sceneFrame.locator('.scene-canvas-host')).toBeAttached({
      timeout: 5000,
    });
    await expect(sceneFrame).toHaveAttribute('data-canvas-active', 'true', {
      timeout: 5000,
    });
  });

  test('wanderer host ships SVG fallback + hosts a <canvas> after hydration', async ({
    page,
  }) => {
    test.skip(
      true,
      'Wanderer disabled since PR #58 (2026-05-11). Reinstate when the redesign brief in docs/wanderer-redesign-brief.md is closed. Until then #companion is not rendered and these assertions would fail.',
    );
    await page.goto('/');
    await expect(page.locator('#companion')).toBeAttached();
    await expect(page.locator('#companion .companion-svg')).toBeAttached();
    await page.waitForTimeout(1500);
  });

  test('reduced-motion: canvas stays hidden; SVG remains primary', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // AgentGraphClient's getSnapshot() reads `prefers-reduced-motion` and
    // returns false, so `{render ? <AgentGraph /> : null}` never renders
    // AgentGraph — `.scene-canvas-host` is AgentGraph's only DOM node, so
    // it never mounts at all (not merely CSS-hidden). Assert absence.
    const canvasHost = page.locator('.scene-canvas-host');
    await expect(canvasHost).toHaveCount(0);
    // Wanderer crane bails early when reduceMotion is true, so no canvas
    // should be inside #companion. With Wanderer disabled site-wide (PR #58)
    // #companion is not in the DOM at all — the count check still holds
    // (zero canvases match a missing parent) but the assertion is no longer
    // exercising the bail-out path. Keep it for completeness; reinstating
    // the Wanderer per docs/wanderer-redesign-brief.md re-arms it.
    const crane = page.locator('#companion canvas');
    await expect(crane).toHaveCount(0);
  });

  test('[data-motion="off"]: canvas host hidden', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-motion', 'off');
    });
    // Same JS gate as the reduced-motion test: the `data-motion="off"`
    // MutationObserver flips AgentGraphClient's getSnapshot() to false,
    // unmounting AgentGraph entirely — `.scene-canvas-host` never exists
    // in the DOM once the attribute flips. Assert absence, not visibility.
    const canvasHost = page.locator('.scene-canvas-host');
    await expect(canvasHost).toHaveCount(0);
  });

  test('no console errors on home page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Allow a stabilisation window for AgentGraph + Wanderer to run at least one
    // frame before we sample console state.
    await page.waitForTimeout(1500);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
