import { expect, test, type Page } from '@playwright/test';

/**
 * Ship It movement contract, recreated against the real mounted production
 * page (spec 006 R3/R4/R5).
 *
 * Everything here drives the shipped page in `/#shipit` — the same canvas,
 * rAF loop and engine the site ships — never a test double. Actor state is
 * read through `window.__shipitProbe`, an inert diagnostic surface created by
 * lib/scenes/shipit.ts only when an init script sets `__shipitProbeWanted`
 * before mount; normal visitors never allocate it. Assertions are exact pixel
 * reads and in-page frame watchers, not score or screenshot guesses.
 *
 * This file deliberately does NOT `declare global`: the surviving
 * e2e/shipit.spec.ts augments `Window` with its own probe shape, and a second
 * conflicting merge would break the whole e2e typecheck. Every access here
 * goes through a local cast instead.
 *
 * Transient movement facts (a turn that lasts exactly one frame) are sampled
 * by rAF watchers installed INSIDE the page, because a host round-trip is
 * longer than the fact being observed.
 *
 * Each assertion documents the implementation inversion it catches.
 */

test.describe.configure({ timeout: 90_000 });

/** Engine direction encoding (lib/shipit/targeting.ts): UP < LEFT < DOWN < RIGHT. */
const UP = 0;
const LEFT = 1;
const DOWN = 2;
const RIGHT = 3;

const TILE = 16;

/** R4 cornering window, mirrored from CORNERING_WINDOW_PX in lib/shipit/game.ts. */
const CORNERING_WINDOW_PX = 4;
/**
 * Tunnel pace is 40% of base versus the normal 75% bug pace (a 40/75 ≈ 0.53
 * distance ratio per equal tick). The tolerant strict bound only fails when
 * the slowdown regresses toward the normal rate (ratio ≈ 1).
 */
const TUNNEL_RATIO_CEILING = 0.75;
const GHOST_NORMAL_PX_PER_MS = (75.757574 * 0.75) / 1000;

/** Row-1 wall hold: the last open centre before the border wall is tile (12,1). */
const STOP_X = 12 * TILE + 8;
const STOP_Y = 1 * TILE + 8;
/** Junction used to prove ghosts wait for a centre before turning. */
const GHOST_CORNER_X = 6 * TILE + 8;
const GHOST_CORNER_ROW_Y = 8 * TILE + 8;
const GHOST_START_TILE_X = 6 + 5 / TILE;
/** Row-25 player corner: turning into column 9 snaps to lane centre 152. */
const CORNER_X = 9 * TILE + 8;
const CORNER_ROW_Y = 25 * TILE + 8;
/** Warp tunnel: row 14 (centres at y=232) on a 28-tile (448px) board. */
const TUNNEL_CENTRE_Y = 14 * TILE + 8;
const FLOOR_CENTRE_Y = 8 * TILE + 8;
const BOARD_PX = 28 * TILE;

const HOLD_MID_MS = 600;
const HOLD_TAIL_MS = 800;
const WRAP_DEADLINE_MS = 8_000;
const MEASURE_FRAMES = 8;

const CANVAS_NAME =
  'Ship It maze — a blinking cursor eats code characters while four bugs give chase';

type ProbeActor = { x: number; y: number; facing: number; desired: number | null };
type ProbeState = { phase: string; player: ProbeActor; ghosts: Record<string, ProbeActor> };

/** Local view of the scene's opt-in probe; intentionally not a global merge. */
type ShipItProbe = {
  placePlayer(tileX: number, tileY: number, facing: number, desired: number | null): void;
  parkGhost(kind: string, tileX: number, tileY: number, facing?: number): void;
  setDesired(direction: number | null): void;
  holdHouse(): void;
  advance(deltaMs: number): void;
  read(): ProbeState;
};

type ShipItProbeWindow = Window & {
  __shipitProbeWanted?: boolean;
  __shipitProbe?: ShipItProbe;
};

/** Runs before any app code; the scene allocates the probe only when it sees the flag. */
async function optInToProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const testWindow = window as ShipItProbeWindow;
    testWindow.__shipitProbeWanted = true;
  });
}

const probeExists = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const testWindow = window as ShipItProbeWindow;
    return Boolean(testWindow.__shipitProbe);
  });

const readProbe = (page: Page): Promise<ProbeState | null> =>
  page.evaluate(() => {
    const testWindow = window as ShipItProbeWindow;
    return testWindow.__shipitProbe?.read() ?? null;
  });

function status(page: Page, label: string) {
  return page.locator('#shipit .px-shipit-status > div').filter({ hasText: label }).locator('dd');
}

async function startRun(page: Page): Promise<void> {
  const section = page.locator('#shipit');
  await section.scrollIntoViewIfNeeded();
  const canvas = section.getByRole('img', { name: CANVAS_NAME });
  await expect
    .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
    .toBeGreaterThan(100);
  await expect.poll(() => probeExists(page)).toBe(true);
  await section.getByRole('button', { name: 'Start shipping' }).click();
  await expect(status(page, 'State')).toHaveText('Shipping');
}

/**
 * Stage bugs in distant corridors so they cannot collide with the movement
 * scenario during its short observation window.
 */
async function freezeScouts(
  page: Page,
  placements: ReadonlyArray<readonly [kind: string, x: number, y: number, facing: number]>,
): Promise<void> {
  const rows = placements.map(([kind, x, y, facing]) => ({ kind, x, y, facing }));
  await page.evaluate((staged) => {
    const testWindow = window as ShipItProbeWindow;
    const probe = testWindow.__shipitProbe;
    if (!probe) throw new Error('ship-it probe is not installed');
    for (const row of staged) probe.parkGhost(row.kind, row.x, row.y, row.facing);
  }, rows);
}

test.describe('Ship It movement contract (instrumented)', () => {
  /**
   * R3 corner-stuck on the real mounted page.
   *
   * Requirement sensitivity — the inversion each assertion catches:
   * - "bounce off the wall" (the arcade defect): x oscillates away from the
   *   stop centre, so the byte-equal reads at mid-hold and tail fail.
   * - auto-reverse on impact: facing flips to LEFT; the facing assertions fail.
   * - a hold that creeps: x/y drift past the stop centre; the byte-equal
   *   reads fail even though the caret looks "roughly" stopped.
   * - dropping the held desired bit while stuck: `desired` is no longer UP at
   *   either hold sample.
   * - deferring the legal turn: the one-step before/after assertion stays RIGHT.
   */
  test('corner-stuck: stops at the wall, stays byte-stable holding the desired direction, takes it on the first legal frame', async ({
    page,
  }) => {
    await optInToProbe(page);
    await page.goto('/#shipit');
    await startRun(page);

    // Scouts out of the way before staging the run.
    await freezeScouts(page, [
      ['direct', 26, 8, RIGHT],
      ['ambush', 1, 8, LEFT],
      ['flank', 26, 29, RIGHT],
      ['shy', 1, 29, LEFT],
    ]);

    // Row 1 heading RIGHT with UP held: UP is walled along the entire run, so
    // no junction can rescue the hold before the border wall. The caret must
    // slide to the last open centre (12,1) and stop there: x=200, y=24.
    await page.evaluate(
      ({ right, up }) => {
        const testWindow = window as ShipItProbeWindow;
        const probe = testWindow.__shipitProbe;
        if (!probe) throw new Error('ship-it probe is not installed');
        probe.placePlayer(10, 1, right, up);
      },
      { right: RIGHT, up: UP },
    );

    await expect
      .poll(async () => {
        const state = await readProbe(page);
        return state?.player.x === STOP_X && state.player.y === STOP_Y;
      })
      .toBe(true);
    const stopped = (await readProbe(page))?.player;
    if (!stopped) throw new Error('poll resolved without a stop sample');

    // Byte-for-byte stability across time, sampled twice more.
    await page.waitForTimeout(HOLD_MID_MS);
    const mid = (await readProbe(page))?.player;
    await page.waitForTimeout(HOLD_TAIL_MS);
    const tail = (await readProbe(page))?.player;
    for (const [label, sample] of [
      ['mid-hold', mid],
      ['tail-hold', tail],
    ] as const) {
      if (!sample) throw new Error(`probe vanished during the ${label}`);
      expect(sample.x, `${label}: byte-for-byte stop x (catches bounce and creep)`).toBe(stopped.x);
      expect(sample.y, `${label}: byte-for-byte stop y`).toBe(stopped.y);
      expect(sample.facing, `${label}: facing never reversed against the wall`).toBe(RIGHT);
      expect(sample.desired, `${label}: the held direction survives the hold`).toBe(UP);
    }

    // Release: DOWN is legal at this tile. Advance one synchronous
    // simulation millisecond through the mounted scene's opt-in probe. The
    // before/after pair proves the turn happens in the first step that can
    // see the new desired direction; a deferred turn leaves facing RIGHT.
    const takeUp = await page.evaluate(
      ({ down }) => {
        const testWindow = window as ShipItProbeWindow;
        const probe = testWindow.__shipitProbe;
        if (!probe) return null;
        const before = probe.read().player;
        probe.setDesired(down);
        probe.advance(1);
        return { before, after: probe.read().player };
      },
      { down: DOWN },
    );
    if (!takeUp) throw new Error('the ship-it probe vanished before the legal turn');
    expect(takeUp.before.desired, 'the blocked direction was still held before new input').toBe(UP);
    expect(takeUp.after.facing, 'the first legal step takes the new desired direction').toBe(DOWN);
    expect(takeUp.after.desired, 'the accepted direction leaves no stale queued input').toBeNull();
    expect(takeUp.after.y, 'the caret moves down in the same simulation step').toBeGreaterThan(
      STOP_Y,
    );
    expect(takeUp.after.x).toBe(STOP_X);
  });

  /**
   * R4 cornering asymmetry, both sides of the rule.
   *
   * Requirement sensitivity — the probe samples engine state between frames,
   * and a between-frames sample IS the frame-start state of the next frame,
   * which is exactly what the windowed turn consults. So the sample pair
   * around the turn is byte-exact evidence of where the turn began:
   * - Removing the player's pre-centre window (turn only AT the centre)
   *   always starts the turning frame byte-exact on the centre (the stepper
   *   never overshoots centres), so `prevDx > 0` fails with prevDx === 0.
   * - Widening the window beyond ~4px starts the turn farther out, so the
   *   `prevDx <= CORNERING_WINDOW_PX` bound fails with the real overshoot.
   * - Giving ghosts the same early turn: the in-page watcher observes the
   *   Arrow's facing changed while still short of the centre and returns a
   *   nonzero distance instead of exactly 0.
   */
  test('cornering asymmetry: the player cuts before the centre within 4px; a staged ghost waits for the centre', async ({
    page,
  }) => {
    // Reduced motion keeps the mounted scene from racing the diagnostic
    // millisecond steps below. The production engine is still the one being
    // advanced; only its clock is deterministic.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await optInToProbe(page);
    await page.goto('/#shipit');
    await startRun(page);

    const playerCut = await page.evaluate(
      ({ cornerX, maxSteps, left, down }) => {
        const testWindow = window as ShipItProbeWindow;
        const probe = testWindow.__shipitProbe;
        if (!probe) return null;
        probe.placePlayer(11, 25, left, down);
        let previous = probe.read().player;
        for (let step = 0; step < maxSteps; step += 1) {
          probe.advance(1);
          const current = probe.read().player;
          if (current.facing === down) {
            return { previous, current, distanceBefore: previous.x - cornerX };
          }
          previous = current;
        }
        return null;
      },
      { cornerX: CORNER_X, maxSteps: 1_000, left: LEFT, down: DOWN },
    );
    if (!playerCut) throw new Error('the staged player never took the DOWN corner');
    expect(
      playerCut.distanceBefore,
      'an at-centre-only player turn starts with zero distance remaining',
    ).toBeGreaterThan(0);
    expect(
      playerCut.distanceBefore,
      'the player starts the turn inside the four-pixel cornering window',
    ).toBeLessThanOrEqual(CORNERING_WINDOW_PX);
    expect(playerCut.previous.y, 'the player had not descended before the cut').toBe(CORNER_ROW_Y);
    expect(playerCut.current.x, 'the cut snaps onto the perpendicular lane centre').toBe(CORNER_X);
    expect(playerCut.current.y, 'the player descends during the cut step').toBeGreaterThan(
      CORNER_ROW_Y,
    );

    // Fresh mounted engine for the ghost leg. Direct approaches the known
    // T-junction at (6,8) from five pixels to its right; scatter targets
    // (1,1), so the leg must visibly turn UP. One-millisecond steps make the
    // centre boundary exact. Giving ghosts the player's early-turn window
    // changes `distanceBefore` from zero to roughly four pixels.
    await page.reload();
    await startRun(page);
    const ghostTurn = await page.evaluate(
      ({ cornerX, maxSteps, left, up, right, startTileX }) => {
        const testWindow = window as ShipItProbeWindow;
        const probe = testWindow.__shipitProbe;
        if (!probe) return null;
        probe.placePlayer(12, 1, right, up);
        probe.parkGhost('direct', startTileX, 8, left);
        let previous = probe.read().ghosts.direct;
        if (!previous) return null;
        for (let step = 0; step < maxSteps; step += 1) {
          probe.advance(1);
          const current = probe.read().ghosts.direct;
          if (!current) return null;
          if (current.facing !== left) {
            return { previous, current, distanceBefore: previous.x - cornerX };
          }
          previous = current;
        }
        return null;
      },
      {
        cornerX: GHOST_CORNER_X,
        maxSteps: 500,
        left: LEFT,
        up: UP,
        right: RIGHT,
        startTileX: GHOST_START_TILE_X,
      },
    );
    if (!ghostTurn) throw new Error('the staged Direct bug never reached its UP junction');
    expect(ghostTurn.current.facing, 'the ghost leg is non-vacuous: it turns UP').toBe(UP);
    expect(
      ghostTurn.distanceBefore,
      'a ghost waits on the exact centre before choosing a perpendicular exit',
    ).toBeLessThanOrEqual(GHOST_NORMAL_PX_PER_MS + 0.001);
    expect(ghostTurn.previous.y, 'the ghost stayed lane-centred before the decision').toBe(
      GHOST_CORNER_ROW_Y,
    );
    expect(ghostTurn.current.x, 'the ghost turns on the exact tile centre').toBeCloseTo(
      GHOST_CORNER_X,
      5,
    );
    expect(ghostTurn.current.y, 'the ghost moves up only after reaching the centre').toBeLessThan(
      GHOST_CORNER_ROW_Y,
    );
  });

  /**
   * R5 tunnel wrap plus ghost tunnel slowdown.
   *
   * Requirement sensitivity:
   * - wrapTunnel removed: the bug sails past x<0 — `outOfRange` flips true
   *   (tile lookups desync from the maze the moment it does) and the opposite
   *   side is never reached, so `wrapped` stays false.
   * - clamping instead of wrapping: the bug sticks at column 0 forever; the
   *   left mouth is seen but the opposite side never is — `wrapped` false.
   * - a player-only wrap hack: the crossing assertions above read ghost
   *   state directly, so they still expose a missing ghost-side treatment.
   * - restoring full tunnel speed: the per-tick ratio climbs to ≈1 and the
   *   strict `< 0.75` bound fails.
   */
  test('tunnel: a bug crosses mouth to mouth without leaving the board and covers materially less ground per equal tick', async ({
    page,
  }) => {
    await optInToProbe(page);
    await page.goto('/#shipit');
    await startRun(page);

    const run = await page.evaluate(
      async ({ deadlineMs, frames, boardPx, tile }) => {
        const testWindow = window as ShipItProbeWindow;
        const probe = testWindow.__shipitProbe;
        if (!probe) return null;
        probe.parkGhost('ambush', 26, 8, 3);
        probe.parkGhost('flank', 26, 29, 3);
        probe.parkGhost('shy', 1, 29, 1);
        probe.placePlayer(18, 17, 1, null);
        probe.parkGhost('direct', 0, 14, 1); // the runner, in the left mouth

        const nextFrame = (): Promise<void> =>
          new Promise((resolve) => requestAnimationFrame(() => resolve()));

        let sawLeftMouth = false;
        let sawOppositeSide = false;
        let outOfRange = false;
        const startedAt = performance.now();
        while (performance.now() - startedAt < deadlineMs) {
          await nextFrame();
          const bug = probe.read().ghosts.direct;
          if (!bug) break;
          if (bug.x < -tile / 2 || bug.x > boardPx + tile / 2) outOfRange = true;
          if (Math.floor(bug.y / tile) === 14) {
            const col = Math.floor(bug.x / tile);
            if (col <= 5) sawLeftMouth = true;
            else if (col >= 22 && sawLeftMouth) sawOppositeSide = true;
          }
          if (sawOppositeSide) break;
        }

        if (!sawOppositeSide) {
          return {
            sawLeftMouth,
            sawOppositeSide,
            outOfRange,
            wrapped: false,
            tunnel: null,
            floor: null,
          };
        }

        // Distance over the same count of rAF frames on both surfaces — the
        // equal elapsed time is what makes the ratio a speed statement.
        const measure = async (): Promise<{ dx: number; yBefore: number; yAfter: number }> => {
          const before = probe.read().ghosts.direct!;
          for (let i = 0; i < frames; i += 1) await nextFrame();
          const after = probe.read().ghosts.direct!;
          return { dx: Math.abs(after.x - before.x), yBefore: before.y, yAfter: after.y };
        };
        const tunnel = await measure();
        probe.parkGhost('direct', 24, 8, 1);
        const floor = await measure();
        return { sawLeftMouth, sawOppositeSide, outOfRange, wrapped: true, tunnel, floor };
      },
      { deadlineMs: WRAP_DEADLINE_MS, frames: MEASURE_FRAMES, boardPx: BOARD_PX, tile: TILE },
    );
    if (!run) throw new Error('ship-it probe is not installed');

    expect(run.wrapped, 'the bug crossed from the left mouth to the opposite side in time').toBe(
      true,
    );
    expect(run.sawLeftMouth, 'the journey started in the left mouth').toBe(true);
    expect(run.outOfRange, 'no coordinate crossed the tunnel wrap threshold').toBe(false);

    if (!run.tunnel || !run.floor) throw new Error('distance measurements are missing');
    expect(run.tunnel.dx, 'the bug made forward progress inside the tunnel').toBeGreaterThan(0);
    expect(run.floor.dx, 'the bug made forward progress on the open floor').toBeGreaterThan(0);
    expect(run.tunnel.yBefore, 'the tunnel sample stayed on the warp row').toBe(TUNNEL_CENTRE_Y);
    expect(run.tunnel.yAfter).toBe(TUNNEL_CENTRE_Y);
    expect(run.floor.yBefore, 'the floor sample stayed on its open lane').toBe(FLOOR_CENTRE_Y);
    expect(run.floor.yAfter).toBe(FLOOR_CENTRE_Y);

    const ratio = run.tunnel.dx / run.floor.dx;
    expect(
      ratio,
      'tunnel distance per equal elapsed time is materially below the normal lane (40/75 ≈ 0.53, bound 0.75)',
    ).toBeLessThan(TUNNEL_RATIO_CEILING);
  });
});
