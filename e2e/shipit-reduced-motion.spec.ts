import { expect, test, type Page } from '@playwright/test';

/**
 * Ship It's reduced-motion contract, instrumented at the scheduler level.
 *
 * `reduced-motion.spec.ts` samples canvas bytes — what a user can observe.
 * Sampling alone cannot tell a honoured veto from a scene that ignores the
 * preference and happens to repaint the same frame every tick: that bug lives
 * in the scheduler, which sampling never sees. This spec wraps
 * `requestAnimationFrame` in an init script that runs before any page script,
 * tracks every scheduled callback's animation-loop lineage, and can therefore
 * watch loops START — the exact thing `startLoop()` in lib/scenes/shipit.ts
 * must refuse under reduced motion.
 *
 * Attribution is scoped, not global: `/` legitimately carries other canvas
 * scenes (pixel fields, the footer marquee) whose loops idle through rAF even
 * under reduced motion, so raw page-wide rAF counts say nothing about Ship It.
 * Instead, each game interaction — pressing Start, a key press — is wrapped in
 * a named scope spanning the browser-event dispatch, and the probe tags every
 * rAF lineage rooted inside one. A lineage that chains three-plus links is a
 * loop. The reduced-motion claim is then exact: no lineage rooted while the
 * player interacts with the game ever becomes a loop. Inverting the veto
 * (dropping `reduced` from `startLoop`) fails that immediately — the loop
 * takes root inside the Start click's dispatch — and the caret's eat-cycle
 * also breaks the byte-stable sampling below.
 *
 * The no-preference control runs the identical scoping against a live game,
 * watches the game's own loop take root, and confirms the board moves — so
 * the zero in the reduced test is a measurement, not a dead probe.
 *
 * Everything runs against the real mounted section on `/`, never the engine
 * in isolation.
 */

test.describe.configure({ timeout: 60_000 });

const SETTLE_MS = 1200;

const CANVAS_NAME =
  'Ship It maze — a blinking cursor eats code characters while four bugs give chase';

type RafStats = { total: number; scopedLoops: number };
type LoopProbe = {
  total: number;
  beginScope(name: string): void;
  endScope(name: string): void;
  stats(): RafStats;
};

declare global {
  interface Window {
    /** Installed by shipit-reduced-motion.spec.ts before any page script. */
    __rafProbe?: LoopProbe;
  }
}

/**
 * Installed before page load, so every rAF the app ever schedules goes
 * through this wrapper. Each root call founds a lineage tagged with whatever
 * scopes are open; a call made from inside a rAF callback chains its lineage
 * onward. Three chained links is a loop, not a one-shot frame; only recently
 * active loops are reported, so long-dead one-shots never haunt the tally.
 */
async function installLoopProbe(page: Page): Promise<void> {
  await page.addInitScript((): void => {
    const nativeRaf = window.requestAnimationFrame.bind(window);
    const lineages = new Map<number, { links: number; scopes: string[]; lastLinkAt: number }>();
    let nextLineage = 0;
    let currentLineage: number | null = null;
    let callbackDepth = 0;
    const openScopes: string[] = [];
    const probe: LoopProbe = {
      total: 0,
      beginScope(name: string): void {
        openScopes.push(name);
      },
      endScope(name: string): void {
        const at = openScopes.lastIndexOf(name);
        if (at < 0) throw new Error(`scope "${name}" ended but never began`);
        openScopes.splice(at, 1);
      },
      stats(): RafStats {
        const now = performance.now();
        let scopedLoops = 0;
        for (const record of lineages.values()) {
          if (record.scopes.length > 0 && record.links >= 3 && now - record.lastLinkAt < 500) {
            scopedLoops += 1;
          }
        }
        return { total: probe.total, scopedLoops };
      },
    };
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      probe.total += 1;
      let lineage: number;
      if (callbackDepth > 0 && currentLineage !== null) {
        lineage = currentLineage;
        const record = lineages.get(lineage);
        if (!record) throw new Error('rAF called from inside a frame without a lineage');
        record.links += 1;
        record.lastLinkAt = performance.now();
      } else {
        lineage = ++nextLineage;
        lineages.set(lineage, {
          links: 0,
          scopes: [...openScopes],
          lastLinkAt: performance.now(),
        });
      }
      return nativeRaf((now: number) => {
        callbackDepth += 1;
        const previous = currentLineage;
        currentLineage = lineage;
        try {
          callback(now);
        } finally {
          currentLineage = previous;
          callbackDepth -= 1;
        }
      });
    };
    window.__rafProbe = probe;
  });
}

const readStats = (page: Page): Promise<RafStats> =>
  page.evaluate(() => {
    const probe = window.__rafProbe;
    if (!probe) throw new Error('loop probe missing — the init script did not run');
    return probe.stats();
  });

/** Runs `action` with a named probe scope spanning its event dispatches. */
async function withScope(page: Page, name: string, action: () => Promise<void>): Promise<void> {
  await page.evaluate((scope) => {
    const probe = window.__rafProbe;
    if (!probe) throw new Error('loop probe missing — the init script did not run');
    probe.beginScope(scope);
  }, name);
  try {
    await action();
  } finally {
    await page.evaluate((scope) => {
      const probe = window.__rafProbe;
      if (!probe) throw new Error('loop probe missing — the init script did not run');
      probe.endScope(scope);
    }, name);
  }
}

function status(page: Page, label: string) {
  return page.locator('#shipit .px-shipit-status > div').filter({ hasText: label }).locator('dd');
}

function board(page: Page) {
  return page.getByRole('img', { name: CANVAS_NAME });
}

/** Full-frame byte sample, the same observable the sibling spec asserts on. */
const pixels = (page: Page): Promise<string> =>
  board(page).evaluate((element: HTMLCanvasElement) => element.toDataURL());

/** Sized by the scene's own `size()` — the default 300×150 canvas is 150 tall. */
async function awaitBoard(page: Page): Promise<void> {
  const canvas = board(page);
  await expect(canvas).toBeAttached();
  await expect
    .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.height))
    .toBeGreaterThan(300);
  // Let the section mount and reach its steady state before sampling.
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * A blank or flat canvas cannot be the readable still the contract promises:
 * demand painted coverage and colour variety, sampled on a stride so the
 * full-resolution buffer is not walked pixel by pixel.
 */
async function expectReadable(page: Page): Promise<void> {
  const stats = await board(page).evaluate((element: HTMLCanvasElement) => {
    const ctx = element.getContext('2d');
    if (!ctx) throw new Error('canvas lost its 2d context');
    const { width, height } = element;
    const { data } = ctx.getImageData(0, 0, width, height);
    let sampled = 0;
    let painted = 0;
    const colours = new Set<string>();
    for (let offset = 0; offset < data.length; offset += 16) {
      sampled += 1;
      if (data[offset + 3] === 0) continue;
      painted += 1;
      if (colours.size < 32) colours.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
    }
    return { ratio: painted / sampled, colours: colours.size };
  });
  expect(stats.ratio).toBeGreaterThan(0.1);
  expect(stats.colours).toBeGreaterThanOrEqual(4);
}

test.describe('ship it reduced motion', () => {
  test('under prefers-reduced-motion the started game is a readable still that schedules no loop', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installLoopProbe(page);
    await page.goto('/#shipit');
    await awaitBoard(page);

    // The mounted section mirrors the game in the DOM before anyone plays.
    await expect(status(page, 'Score')).toHaveText('0');
    await expect(status(page, 'Lives')).toHaveText('3');
    await expect(status(page, 'State')).toHaveText('Ready');
    await expectReadable(page);

    // Starting is a scoped interaction: any animation loop rooted while the
    // click dispatches belongs to the game.
    await withScope(page, 'start', () =>
      page.getByRole('button', { name: 'Start shipping' }).click(),
    );

    // Started: the DOM shows a live run of a still game, and that still is
    // the readable picture.
    await expect(status(page, 'State')).toHaveText('Shipping');
    await expect(status(page, 'Score')).toHaveText('0');
    await expectReadable(page);

    // The game is running but the scheduler is vetoed: with no input at all,
    // nothing may repaint. (A discrete step moves ghosts too, so an
    // input-freeze assertion would be wrong here; stillness over time is the
    // user-observable half of that contract.)
    const startedPixels = await pixels(page);
    await page.waitForTimeout(500);
    expect(await pixels(page)).toBe(startedPixels);

    // One legal input advances exactly one fixed step — and then holds: no
    // second step arrives on its own.
    await withScope(page, 'input-right', () => page.keyboard.press('ArrowRight'));
    const steppedPixels = await pixels(page);
    expect(steppedPixels).not.toBe(startedPixels);
    await page.waitForTimeout(500);
    expect(await pixels(page)).toBe(steppedPixels);

    // Quiet-window read, then a settle and a second read: any loop the game
    // rooted would be actively chaining and therefore recent enough to
    // report. Zero is the whole point.
    const atStart = await readStats(page);
    await page.waitForTimeout(SETTLE_MS);
    const afterSettle = await readStats(page);
    expect(atStart.scopedLoops).toBe(0);
    expect(afterSettle.scopedLoops).toBe(0);

    // The canonical sampling contract, one beat apart: byte-stable.
    const first = await pixels(page);
    await page.waitForTimeout(SETTLE_MS);
    const second = await pixels(page);
    expect(second).toBe(first);
  });

  test('control: with motion allowed the same probe watches the game loop start', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await installLoopProbe(page);
    await page.goto('/#shipit');
    await awaitBoard(page);

    await withScope(page, 'start', () =>
      page.getByRole('button', { name: 'Start shipping' }).click(),
    );
    await expect(status(page, 'State')).toHaveText('Shipping');

    // Polled by hand so the probe — not Playwright's own machinery — is what
    // observes the lineage. The game's rAF loop chains up within three frames.
    let scopedLoops = 0;
    for (let attempt = 0; attempt < 10 && scopedLoops === 0; attempt += 1) {
      scopedLoops = (await readStats(page)).scopedLoops;
      if (scopedLoops === 0) await page.waitForTimeout(200);
    }
    expect(scopedLoops).toBeGreaterThanOrEqual(1);

    // And the board genuinely moves, so the stillness asserted above means
    // something.
    const first = await pixels(page);
    await page.waitForTimeout(SETTLE_MS);
    const second = await pixels(page);
    expect(second).not.toBe(first);
  });
});
