import { expect, test, type JSHandle, type Page } from '@playwright/test';

/**
 * Lifecycle contract for Ship It (spec 006 SC7 mount/dispose half; U4 item 4).
 *
 * Interaction, accessibility and reduced-motion behaviour live in
 * shipit.spec.ts and reduced-motion.spec.ts. This file owns what only a
 * browser can prove: navigating away from the home page and back leaves no
 * stray animation frame, no listener that still answers, and no second
 * canvas — and the remounted board runs exactly one brand-new loop.
 *
 * Technique: an init script wraps requestAnimationFrame,
 * cancelAnimationFrame and EventTarget.prototype.addEventListener before any
 * app code runs. The wrappers preserve native ids and listener identities,
 * so the app behaves normally; the probe only records.
 *
 * Loop attribution is by lineage, not by name or stack: a frame request made
 * synchronously from inside a probe-invoked callback inherits that callback's
 * lineage, so every self-perpetuating rAF loop on the page (hero heatfield,
 * marquee, custom cursor) is one traceable lineage with a birth sequence
 * number. The game's loop is identified structurally — it is the lineage
 * born in the start-click window that is still re-requesting frames half a
 * second later. Perpetual scenes were born at mount, outside the window;
 * transient one-shot requests die within a frame. Nothing here keys off
 * function names or bundle chunks, so it survives minification.
 *
 * What each leg proves:
 *   - start: exactly one lineage is born and stays alive — one loop.
 *   - away: that lineage's pending frame is cancelled through
 *     cancelAnimationFrame's twin, its request sequence freezes forever
 *     (skipping the explicit cancel would let the orphaned callback tick
 *     once more and advance the sequence), the detached canvas is
 *     pixel-frozen, no pending frame anywhere is older than one frame, and
 *     no listener left the canvas unreleased (inverted AbortController).
 *   - back: the old canvas is gone (no second canvas), the window/
 *     media-query listener inventory is conserved, and starting again births
 *     exactly one new lineage — a new one, not the old revived.
 *
 * These assertions fail if dispose cancellation or abort is inverted.
 */

test.describe.configure({ timeout: 90_000 });

type ListenerKind = 'window' | 'mql' | 'node' | 'other';

type ProbeLineage = {
  id: number;
  /** Sequence number of the request that founded the lineage. */
  bornSeq: number;
  /** Sequence number of the most recent request in the lineage. */
  lastSeq: number;
  /** Frames requested but not yet fired or cancelled. */
  pending: number;
};

/** Shape installed on window by installProbe. Shared by page and test sides. */
type ShipItProbe = {
  started: number;
  cancelled: number;
  seq: number;
  roots: number;
  /** performance.now() of every request, indexed by seq - 1. */
  times: number[];
  /** Pending native handle -> its sequence and lineage. */
  live: Map<number, { seq: number; lineage: number }>;
  lineages: Map<number, ProbeLineage>;
  listeners: Array<{
    type: string;
    kind: ListenerKind;
    target: EventTarget;
    released: boolean;
  }>;
};

type ShipItProbeWindow = {
  requestAnimationFrame: typeof window.requestAnimationFrame;
  cancelAnimationFrame: typeof window.cancelAnimationFrame;
  __shipItProbe?: ShipItProbe;
};

/** Install the probe. Runs in the page before any app script, every navigation. */
function installProbe(): void {
  // Test-authored surface on window: unchecked cast is the only way in.
  const w = window as unknown as ShipItProbeWindow;
  const probe: ShipItProbe = (w.__shipItProbe = {
    started: 0,
    cancelled: 0,
    seq: 0,
    roots: 0,
    times: [],
    live: new Map(),
    lineages: new Map(),
    listeners: [],
  });
  // Lineage of the probe-wrapped callback currently executing, if any.
  let executing: number | null = null;

  const nativeRaf = w.requestAnimationFrame.bind(w);
  const nativeCaf = w.cancelAnimationFrame.bind(w);

  w.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const seq = ++probe.seq;
    probe.started++;
    probe.times.push(performance.now());
    // Requests from inside a firing callback continue that lineage; free
    // standing requests found new ones.
    const lineageId = executing ?? ++probe.roots;
    let lineage = probe.lineages.get(lineageId);
    if (!lineage) {
      lineage = { id: lineageId, bornSeq: seq, lastSeq: seq, pending: 0 };
      probe.lineages.set(lineageId, lineage);
    }
    lineage.lastSeq = seq;
    lineage.pending++;
    const handle = nativeRaf((now) => {
      probe.live.delete(handle);
      lineage.pending--;
      const previous = executing;
      executing = lineageId;
      try {
        cb(now);
      } finally {
        executing = previous;
      }
    });
    probe.live.set(handle, { seq, lineage: lineageId });
    return handle;
  }) as typeof window.requestAnimationFrame;

  w.cancelAnimationFrame = ((handle: number) => {
    const pendingFrame = probe.live.get(handle);
    if (pendingFrame) {
      probe.cancelled++;
      probe.live.delete(handle);
      const lineage = probe.lineages.get(pendingFrame.lineage);
      if (lineage) lineage.pending--;
    }
    return nativeCaf(handle);
  }) as typeof window.cancelAnimationFrame;

  const kindOf = (target: EventTarget): ListenerKind => {
    if (target === window) return 'window';
    if (typeof MediaQueryList !== 'undefined' && target instanceof MediaQueryList) return 'mql';
    if ((target as Node).nodeType === 1) return 'node';
    return 'other';
  };

  const rawAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (typeof listener === 'function') {
      const optionsRecord =
        typeof options === 'object' && options ? (options as AddEventListenerOptions) : undefined;
      const entry = { type, kind: kindOf(this), target: this, released: false };
      probe.listeners.push(entry);
      optionsRecord?.signal?.addEventListener(
        'abort',
        () => {
          entry.released = true;
        },
        { once: true },
      );
    }
    return rawAdd.call(this, type, listener, options);
  };
}

type ProbeSnapshot = {
  started: number;
  cancelled: number;
  liveCount: number;
  oldestLiveAgeMs: number | null;
  groups: Record<string, number>;
  detachedListeners: number;
  lineages: ProbeLineage[];
};

async function readProbe(page: Page): Promise<ProbeSnapshot> {
  return page.evaluate(() => {
    // Same test-authored surface as installProbe.
    const w = window as unknown as ShipItProbeWindow;
    const probe = w.__shipItProbe;
    if (!probe) throw new Error('ship-it lifecycle probe is not installed');
    const groups: Record<string, number> = {};
    let detachedListeners = 0;
    for (const entry of probe.listeners) {
      if (entry.released) continue;
      if (entry.kind === 'window' || entry.kind === 'mql') {
        const key = `${entry.kind}:${entry.type}`;
        groups[key] = (groups[key] ?? 0) + 1;
      } else if (entry.kind === 'node' && !(entry.target as Node).isConnected) {
        detachedListeners++;
      }
    }
    const now = performance.now();
    let oldest = Number.POSITIVE_INFINITY;
    for (const pendingFrame of probe.live.values()) {
      const requestedAt = probe.times[pendingFrame.seq - 1] ?? Number.POSITIVE_INFINITY;
      if (requestedAt < oldest) oldest = requestedAt;
    }
    return {
      started: probe.started,
      cancelled: probe.cancelled,
      liveCount: probe.live.size,
      oldestLiveAgeMs: probe.live.size ? now - oldest : null,
      groups,
      detachedListeners,
      lineages: Array.from(probe.lineages.values()).sort((a, b) => a.bornSeq - b.bornSeq),
    };
  });
}

/** Unreleased listeners still attached to one specific element. */
async function unreleasedOn(page: Page, element: JSHandle): Promise<number> {
  return page.evaluate((target) => {
    const w = window as unknown as ShipItProbeWindow;
    const probe = w.__shipItProbe;
    if (!probe) throw new Error('ship-it lifecycle probe is not installed');
    let count = 0;
    for (const entry of probe.listeners) {
      if (!entry.released && entry.target === target) count++;
    }
    return count;
  }, element);
}

function status(page: Page, label: string) {
  return page.locator('#shipit .px-shipit-status > div').filter({ hasText: label }).locator('dd');
}

async function canvasReady(page: Page): Promise<void> {
  const canvas = page.locator('#shipit .px-shipit-canvas');
  await expect
    .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
    .toBeGreaterThan(400);
}

async function startShipping(page: Page): Promise<void> {
  await page.locator('#shipit').getByRole('button', { name: 'Start shipping' }).click();
  await expect(status(page, 'State')).toHaveText('Shipping');
}

test.describe('Ship It lifecycle', () => {
  test('navigating away and back leaves no stray loop, no answering listener and exactly one new loop', async ({
    page,
  }) => {
    await page.addInitScript(installProbe);
    await page.goto('/#shipit');

    // The probe is alive: the hero field has mounted and asked for a frame.
    // Everything after this point runs against hydrated client code.
    await expect
      .poll(() => readProbe(page).then((snapshot) => snapshot.started))
      .toBeGreaterThan(0);
    await canvasReady(page);
    // Let the mount-born lineages (heatfield, marquee, cursor) light up so
    // the click windows below contain only what the click itself births.
    await page.waitForTimeout(500);

    // --- First activation: exactly one lineage is born and survives. ---
    const beforeFirst = await readProbe(page);
    await startShipping(page);
    const afterFirst = await readProbe(page);
    const bornInFirstWindow = afterFirst.lineages.filter(
      (lineage) => lineage.bornSeq > beforeFirst.started && lineage.bornSeq <= afterFirst.started,
    );
    // Half a second of running separates survivors from transients: only
    // the game loop re-requests across the whole span.
    await page.waitForTimeout(650);
    const running1 = await readProbe(page);
    const firstLoops = bornInFirstWindow.filter((born) => {
      const lineage = running1.lineages.find((candidate) => candidate.id === born.id);
      return lineage !== undefined && lineage.pending > 0;
    });
    expect(firstLoops, 'starting the game should birth exactly one persistent loop').toHaveLength(
      1,
    );
    const firstLoop = firstLoops[0]!;
    const firstLoopLastSeq = running1.lineages.find(
      (candidate) => candidate.id === firstLoop.id,
    )!.lastSeq;

    // Remember the mounted canvas element; the coming soft navigation keeps
    // this execution context, so the handle stays readable while detached.
    const oldCanvas = await page.locator('#shipit .px-shipit-canvas').evaluateHandle((el) => el);

    // --- Away: soft-navigate to /writing through the header. ---
    await page.locator('.px-header').getByRole('link', { name: 'Writing' }).click();
    await expect(page).toHaveURL(/\/writing$/);

    // The unmount has committed by the time the canvas is detached (Next
    // updates the URL before React swaps the tree, and a first visit to
    // /writing compiles on demand, so everything before this point raced
    // the game's last legitimate frames). Dispose runs synchronously in the
    // commit that detaches, so this is the anchor: any advance past it is
    // an orphaned callback.
    await expect(page.locator('.px-shipit-canvas')).toHaveCount(0);
    expect(
      await oldCanvas.evaluate((el) => (el as Element).isConnected),
      'the first canvas should be detached',
    ).toBe(false);
    const frozenPixels = await oldCanvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    const freezeAnchor = await readProbe(page);
    const anchorLoop = freezeAnchor.lineages.find((candidate) => candidate.id === firstLoop.id);

    // Dwell long enough that an orphaned loop would have ticked dozens of
    // times, then prove nothing moved: not the canvas (a surviving callback
    // would repaint it through the stale 2D context — the caret blinks and
    // the pellet pulse advance every frame) and not the request sequence.
    await page.waitForTimeout(700);
    expect(
      await oldCanvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL()),
      'the detached canvas kept repainting',
    ).toBe(frozenPixels);

    // Dispose cancelled the loop's pending frame through
    // cancelAnimationFrame's twin, and the lineage is dead: pending == 0.
    // One further firing is tolerated by design — the scene zeroes its
    // handle before checking `disposed`, so the frame that was in flight at
    // dispose fires once more and returns without stepping, drawing or
    // re-requesting. A leaked loop advances by hundreds; an inverted
    // cancellation (dispose skipping its explicit cancel) also lets that
    // orphaned callback tick on every frame from here on. Both fail the
    // bounded advance below; a correct dispose advances by at most one.
    const away = await readProbe(page);
    const awayLoop = away.lineages.find((candidate) => candidate.id === firstLoop.id);
    expect(awayLoop, 'the game lineage vanished from the probe').toBeDefined();
    expect(awayLoop!.pending, 'the first loop still has a frame in flight').toBe(0);
    expect(
      away.cancelled,
      'dispose must cancel pending frames explicitly, not let them fire',
    ).toBeGreaterThan(beforeFirst.cancelled);
    expect(
      awayLoop!.lastSeq - anchorLoop!.lastSeq,
      'the cancelled loop ticked more than its one in-flight frame',
    ).toBeLessThanOrEqual(1);

    // No frame anywhere is older than one frame: every perpetual scene
    // supersedes its handle every ~16ms, so an older pending request is an
    // orphaned callback pure and simple.
    expect(away.oldestLiveAgeMs ?? 0, 'an orphaned frame survived dispose').toBeLessThan(50);

    // --- Back: soft-navigate home through the wordmark. ---
    await page.locator('.px-wordmark').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('.px-shipit-canvas')).toHaveCount(1);
    await canvasReady(page);
    // Settle the remount before the second activation.
    await page.waitForTimeout(900);

    // The dead loop stays dead after the return: at most the one in-flight
    // firing already accounted for, never a revival. An inverted dispose
    // (no abort) shows up as its canvas listeners still answering below.
    const back = await readProbe(page);
    const backLoop = back.lineages.find((candidate) => candidate.id === firstLoop.id);
    expect(
      (backLoop?.lastSeq ?? 0) - anchorLoop!.lastSeq,
      'the first loop revived after the return',
    ).toBeLessThanOrEqual(1);
    expect(
      await unreleasedOn(page, oldCanvas),
      'listeners left answering on the detached canvas',
    ).toBe(0);
    expect(back.groups).toEqual(beforeFirst.groups);

    // --- Second activation: exactly one brand-new lineage. ---
    const beforeSecond = await readProbe(page);
    await startShipping(page);
    const afterSecond = await readProbe(page);
    const bornInSecondWindow = afterSecond.lineages.filter(
      (lineage) => lineage.bornSeq > beforeSecond.started && lineage.bornSeq <= afterSecond.started,
    );
    await page.waitForTimeout(650);
    const running2 = await readProbe(page);
    const secondLoops = bornInSecondWindow.filter((born) => {
      const lineage = running2.lineages.find((candidate) => candidate.id === born.id);
      return lineage !== undefined && lineage.pending > 0;
    });
    expect(secondLoops, 'the remounted game should run exactly one loop').toHaveLength(1);
    expect(secondLoops[0]!.id, 'the loop after remount is the old one, not a new lineage').not.toBe(
      firstLoop.id,
    );

    // Sanity: the probe kept counting throughout.
    expect(running2.started).toBeGreaterThan(running1.started);
  });
});
