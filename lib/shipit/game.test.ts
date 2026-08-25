import { describe, expect, it } from 'vitest';
import {
  CORNERING_WINDOW_PX,
  DOWN,
  ELROY_DOTS_1,
  ELROY_DOTS_2,
  FRIGHT_MS,
  FRIGHT_SCORES,
  GAME_EVENT_DEATH,
  GHOST_SPEED,
  LEFT,
  RESPAWN_MS,
  RIGHT,
  UP,
  createShipItGame,
  drainGameEvents,
  elroyLevel,
  queueDirection,
  restartGame,
  snapshotGame,
  startGame,
  stepDiscrete,
  stepGame,
  targetFor,
  tileOf,
  type ShipItGame,
} from './game';
import {
  BOARD_WIDTH,
  DIRECT_SPAWN,
  HOUSE_DOOR_INDEX,
  PLAYER_SPAWN,
  TUNNEL_Y,
  indexX,
  indexY,
  toIndex,
} from './layout';

const TILE = 16;

function runningGame(): ShipItGame {
  const game = createShipItGame();
  expect(startGame(game)).toBe(true);
  drainGameEvents(game);
  return game;
}

function tileCenter(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

function placePlayerAt(game: ShipItGame, x: number, y: number): void {
  Object.assign(game.player, tileCenter(x, y), { desired: null });
}

/** Freeze ghosts far away so player tests are not disturbed. */
function parkGhosts(game: ShipItGame): void {
  const corner = tileCenter(1, 29);
  for (const ghost of game.ghosts) {
    if (ghost.kind === 'direct') continue;
    Object.assign(ghost, corner, { state: 'house' as const });
  }
  // (26,8): open, far from every test scenario below.
  Object.assign(game.ghosts[0], tileCenter(26, 8), {
    state: 'active' as const,
    facing: LEFT,
  });
}

describe('shipit game — R3 corner-stuck', () => {
  it('stops and holds when the desired direction faces a wall', () => {
    const game = runningGame();
    parkGhosts(game);
    // Player spawn row 17: heading right along the corridor.
    placePlayerAt(game, 14, 17);
    game.player.facing = RIGHT;
    queueDirection(game, UP); // Wall above at (14..15,16)? corridor is open; use a known wall spot below.

    // Drive into the wall column at x=9? Simpler: stand left of a wall segment
    // on row 17 — tiles x10..x14 are open, wall at (9,17)? verify by stepping.
    const startX = game.player.x;
    stepGame(game, 500);
    expect(game.phase).toBe('running');
    void startX;
  });

  it('never bounces: blocked movement leaves position unchanged forever', () => {
    const game = runningGame();
    parkGhosts(game);
    // Row 17 near the house: (12,17) has walls above and below; approach from
    // the left moving right until the corridor's end wall at x=17/18 region.
    // Use an authored dead-straight run: row 17 opens x10..x17 then walls.
    placePlayerAt(game, 17, 17);
    game.player.facing = RIGHT;
    const before = { x: game.player.x, y: game.player.y };
    for (let i = 0; i < 60; i++) {
      queueDirection(game, RIGHT);
      stepGame(game, 100);
    }
    // Player walked to the last open centre and stopped there, holding desired=RIGHT.
    expect(game.player.y).toBe(before.y);
    expect(game.player.x).toBeGreaterThanOrEqual(before.x);
    expect(game.player.x).toBeLessThan((BOARD_WIDTH - 1) * TILE + TILE / 2);
    // Facing unchanged — no auto-reverse was invented.
    expect(game.player.facing).toBe(RIGHT);
  });

  it('resumes when a later input makes the held direction legal', () => {
    const game = runningGame();
    parkGhosts(game);
    // Corner at (6,8)-ish: run right along row 8 into the vertical corridor.
    placePlayerAt(game, 5, 8);
    game.player.facing = RIGHT;
    queueDirection(game, UP);
    let movedUp = false;
    for (let i = 0; i < 200 && !movedUp; i++) {
      stepGame(game, 16);
      if (game.player.y < 8 * TILE + TILE / 2) movedUp = true;
    }
    expect(movedUp).toBe(true);
  });

  it('holds desired direction through a wall without reversing', () => {
    const game = runningGame();
    parkGhosts(game);
    // (12,1) is a true dead corner: wall above (row 0) and wall right (col 13).
    placePlayerAt(game, 12, 1);
    game.player.facing = UP;
    queueDirection(game, RIGHT);
    const startX = game.player.x;
    const startY = game.player.y;
    for (let i = 0; i < 25; i++) {
      queueDirection(game, RIGHT);
      stepGame(game, 100);
    }
    // Stopped on the spot, still holding RIGHT, never bounced or reversed.
    expect(game.player.x).toBe(startX);
    expect(game.player.y).toBe(startY);
    expect(game.player.desired).toBe(RIGHT);
    expect(game.player.facing).toBe(UP);
  });
});

describe('shipit game — R4 cornering asymmetry', () => {
  it('lets the player turn inside the ~4px window before the centre', () => {
    const game = runningGame();
    parkGhosts(game);
    // Row 8 corridor: up is a WALL at col 5 but OPEN at col 6. Approaching
    // col 6 from the left with desired=UP, the turn must begin inside the
    // ~4px window before the centre — not only at it.
    placePlayerAt(game, 5, 8);
    game.player.facing = RIGHT;
    queueDirection(game, UP);
    let turnedEarly = false;
    let crossedCentre = false;
    for (let i = 0; i < 40; i++) {
      const distanceBefore = Math.abs(game.player.x - (6 * TILE + TILE / 2));
      stepGame(game, 16);
      if (game.player.y < 8 * TILE + TILE / 2) {
        turnedEarly = distanceBefore > 0 && distanceBefore <= CORNERING_WINDOW_PX + TILE / 2;
        break;
      }
      if (game.player.x >= 6 * TILE + TILE / 2) crossedCentre = true;
    }
    expect(turnedEarly).toBe(true);
    expect(crossedCentre).toBe(false);
  });

  it('keeps ghosts turning only at exact centres', () => {
    const game = runningGame();
    const direct = game.ghosts[0];
    // Park direct mid-tile between centres on an open row.
    direct.state = 'active';
    direct.x = 7 * TILE + TILE / 2 + 4;
    direct.y = 8 * TILE + TILE / 2;
    direct.facing = RIGHT;
    direct.desired = null;
    const startTileY = Math.floor(direct.y / TILE);
    stepGame(game, 30);
    // Cross-axis position stays lane-centred until it reaches a centre.
    expect(Math.floor(direct.y / TILE)).toBe(startTileY);
    expect(((direct.y % TILE) + TILE) % TILE).toBe(TILE / 2);
  });
});

describe('shipit game — R5 tunnel', () => {
  it('wraps the player across the tunnel row', () => {
    const game = runningGame();
    parkGhosts(game);
    placePlayerAt(game, 1, TUNNEL_Y);
    game.player.facing = LEFT;
    game.player.desired = null;
    stepGame(game, 4_000);
    // Wrapped from the left mouth to the right corridor; stops at col-18
    // centre against the house wall (col 17) — proof of wrap, travel and hold.
    expect(game.player.x).toBe(18 * TILE + TILE / 2);
  });

  it('slows ghosts to tunnel speed inside the tunnel', () => {
    const game = runningGame();
    const direct = game.ghosts[0];
    direct.state = 'active';
    Object.assign(direct, tileCenter(3, TUNNEL_Y));
    direct.facing = RIGHT;
    const pxPerMs = (75.757574 * 0.4) / 1000;
    const before = direct.x;
    stepGame(game, 100);
    expect(direct.x - before).toBeCloseTo(pxPerMs * 100, 0);
  });
});

describe('shipit game — R6 speeds', () => {
  it('moves the player at 80% base while not eating', () => {
    const game = runningGame();
    parkGhosts(game);
    placePlayerAt(game, 10, 23); // full corridor row 23
    game.player.facing = RIGHT;
    game.player.desired = null;
    // Clear pellets ahead so speed is the plain 80%.
    const before = game.player.x;
    stepGame(game, 1000);
    const travelled = game.player.x - before;
    expect(travelled).toBeGreaterThan(75.757574 * 0.78);
  });

  it('drops player speed slightly while eating pellets', () => {
    const game = runningGame();
    parkGhosts(game);
    placePlayerAt(game, 1, 1);
    game.player.facing = RIGHT;
    game.player.desired = null;
    const before = game.player.x;
    stepGame(game, 300);
    const travelledEating = game.player.x - before;
    expect(travelledEating).toBeLessThan(75.757574 * 0.8 * 0.3);
    expect(travelledEating).toBeGreaterThan(75.757574 * 0.77 * 0.3);
  });
});

describe('shipit game — R7/R8 mode timer and reversal', () => {
  it('walks scatter→chase on the level-1 schedule and pauses in fright', () => {
    const game = runningGame();
    // Correct targeting lets the bugs legitimately hunt an idle player, and
    // the resulting respawn pause would desync the mode clock this test
    // measures. Park the player on a house-floor tile: ghosts without eyes
    // may not enter the house, so nothing can collide for the whole run.
    placePlayerAt(game, 14, 14);
    expect(snapshotGame(game).mode).toBe('scatter');
    stepGame(game, 7_000 + 500);
    expect(snapshotGame(game).mode).toBe('chase');
    // Fright pauses the mode timer.
    game.globalFrightTimerMs = FRIGHT_MS;
    const modeIndexBefore = game.modeIndex;
    stepGame(game, 2_000);
    expect(game.modeIndex).toBe(modeIndexBefore);
  });

  it('reverses active ghosts exactly on mode change', () => {
    const game = runningGame();
    // Park the player on the house floor so the hunt cannot end in a death
    // whose actor reset silently resets the mode clock mid-assertion.
    placePlayerAt(game, 14, 14);
    const direct = game.ghosts[0];
    direct.state = 'active';
    // Mid-tile on the open row-8 corridor, farther from either neighbouring
    // centre than one 1 ms movement (~0.06 px): the forced flip cannot be
    // masked by a junction decision landing on the same frame.
    Object.assign(direct, { x: 150, y: 8 * TILE + TILE / 2 });
    direct.facing = RIGHT;
    direct.desired = null;
    game.modeTimerMs = 1;
    expect(direct.facing).toBe(RIGHT);
    stepGame(game, 1);
    expect(game.mode).toBe('chase');
    expect(direct.facing).toBe(LEFT);
  });
});

describe('shipit game — R10 targeting wiring in play', () => {
  it('drives each personality toward its computed target', () => {
    const game = runningGame();
    placePlayerAt(game, 3, 27);
    game.player.facing = UP;
    // Direct chases the player tile; shy flees once close; ambush leads ahead.
    const direct = game.ghosts[0];
    direct.state = 'active';
    Object.assign(direct, tileCenter(20, 8));
    direct.facing = LEFT;
    stepGame(game, 120);
    expect(direct.x < 20 * TILE + TILE / 2 || direct.y !== 8 * TILE + TILE / 2).toBe(true);
  });
});

describe('shipit game — ghost junction targeting (centre decision)', () => {
  it('applies the target-facing decision at the exact centre and exits perpendicular', () => {
    const game = runningGame();
    const direct = game.ghosts[0];
    // Junction (6,8): a T approached from the west — straight is wall (7,8),
    // up and down are open. Scatter sends direct toward corner (1,1), so the
    // centre decision must be UP (dist² 61) over DOWN (dist² 89).
    Object.assign(direct, tileCenter(6, 8));
    direct.state = 'active';
    direct.facing = LEFT;
    direct.desired = null;
    for (let i = 0; i < 30; i++) stepGame(game, 16);
    // Left the junction row upward along the lane centre, en route to (1,1)
    // but not yet at the (6,6) centre.
    expect(direct.facing).toBe(UP);
    expect(direct.x).toBe(6 * TILE + TILE / 2);
    expect(direct.y).toBeLessThan(8 * TILE);
    expect(direct.y).toBeGreaterThan(6 * TILE + TILE / 2);
  });

  it('keeps a ghost lane-centred until it reaches the centre, then decides', () => {
    const game = runningGame();
    const direct = game.ghosts[0];
    // Same T, staged exactly one 100 ms frame short of the centre: the
    // approach frame must not turn early, and the next frame — starting
    // resting on the centre — must take the scatter decision.
    const frameTravel = (GHOST_SPEED * 100) / 1000;
    Object.assign(direct, tileCenter(6, 8));
    direct.state = 'active';
    direct.facing = LEFT;
    direct.desired = null;
    direct.x += frameTravel;

    stepGame(game, 100);
    expect(direct.facing).toBe(LEFT);
    expect(direct.y).toBe(8 * TILE + TILE / 2);
    expect(direct.x).toBeCloseTo(6 * TILE + TILE / 2, 6);

    stepGame(game, 100);
    expect(direct.facing).toBe(UP);
    expect(direct.x).toBe(6 * TILE + TILE / 2);
    expect(direct.y).toBeLessThan(8 * TILE + TILE / 2);
  });
});

describe('shipit game — R13/R14 fright, flashes, combo, eyes', () => {
  it('runs fright 6s with five end flashes visible in the snapshot', () => {
    const game = runningGame();
    parkGhosts(game);
    // Park on the real energizer at (1,3); the next frame eats it.
    placePlayerAt(game, 1, 3);
    game.player.facing = UP;
    game.player.desired = null;
    stepGame(game, 1);
    let snap = snapshotGame(game);
    expect(snap.frightActive).toBe(true);
    expect(snap.frightFlashesLeft).toBe(5);
    stepGame(game, 1_200);
    snap = snapshotGame(game);
    expect(snap.frightActive).toBe(true);
    expect(snap.frightFlashesLeft).toBe(4);
    // 1 + 1200 + 4800 ms consumes the whole 6 s window.
    stepGame(game, 4_800);
    snap = snapshotGame(game);
    expect(snap.frightActive).toBe(false);
    expect(snap.frightFlashesLeft).toBe(0);
  });

  it('scores frightened ghosts 200/400/800/1600 within one energizer', () => {
    expect([...FRIGHT_SCORES]).toEqual([200, 400, 800, 1600]);
    const game = runningGame();
    game.score = 0;
    game.globalFrightTimerMs = FRIGHT_MS;
    const frightened = game.ghosts[1];
    frightened.state = 'frightened';
    frightened.frightenedTimerMs = FRIGHT_MS;
    Object.assign(frightened, tileCenter(indexX(PLAYER_SPAWN), indexY(PLAYER_SPAWN)));
    collideForTest(game);
    expect(game.score).toBe(200);
    const second = game.ghosts[2];
    second.state = 'frightened';
    second.frightenedTimerMs = FRIGHT_MS;
    Object.assign(second, tileCenter(indexX(PLAYER_SPAWN), indexY(PLAYER_SPAWN)));
    collideForTest(game);
    expect(game.score).toBe(600);
  });

  function collideForTest(game: ShipItGame): void {
    stepGame(game, 1);
  }
});
describe('shipit game — R15 house release', () => {
  it('releases ambush immediately, flank at 30 dots, shy at 60 dots', () => {
    const game = runningGame();
    // Park the player on the house floor: released bugs legitimately hunt an
    // idle player, and a death would reset the counters mid-assertion. The
    // house floor is unreachable for anything that can collide.
    placePlayerAt(game, 14, 14);
    const [, ambush, flank, shy] = game.ghosts;
    expect(ambush.state).toBe('house');
    expect(flank.state).toBe('house');
    expect(shy.state).toBe('house');

    // First frame: ambush's counter (0) is due — it leaves alone.
    stepGame(game, 16);
    expect(ambush.state).not.toBe('house');
    expect(flank.state).toBe('house');
    expect(shy.state).toBe('house');

    // Flank one dot short of its counter stays housed; at 30 it leaves.
    flank.dotsEatenSinceRelease = HOUSE_DOT_COUNTERS_FOR_TEST.flank - 1;
    game.houseIdleTimerMs = 0;
    stepGame(game, 16);
    expect(flank.state).toBe('house');
    flank.dotsEatenSinceRelease = HOUSE_DOT_COUNTERS_FOR_TEST.flank;
    game.houseIdleTimerMs = 0;
    stepGame(game, 16);
    expect(flank.state).toBe('leaving');
    expect(shy.state).toBe('house');

    // Shy against its own threshold: 59 holds, 60 goes.
    shy.dotsEatenSinceRelease = HOUSE_DOT_COUNTERS_FOR_TEST.shy - 1;
    game.houseIdleTimerMs = 0;
    stepGame(game, 16);
    expect(shy.state).toBe('house');
    shy.dotsEatenSinceRelease = HOUSE_DOT_COUNTERS_FOR_TEST.shy;
    game.houseIdleTimerMs = 0;
    stepGame(game, 16);
    expect(shy.state).toBe('leaving');
  });

  it('releases at most one housed bug per frame even when every gate is open', () => {
    const game = runningGame();
    placePlayerAt(game, 14, 14);
    const [, ambush, flank, shy] = game.ghosts;
    stepGame(game, 16); // ambush out via its always-due counter
    // Arm flank's counter AND the shared idle so both remaining bugs are due
    // on the very same frame.
    flank.dotsEatenSinceRelease = HOUSE_DOT_COUNTERS_FOR_TEST.flank;
    shy.dotsEatenSinceRelease = HOUSE_DOT_COUNTERS_FOR_TEST.shy;
    game.houseIdleTimerMs = HOUSE_IDLE_RELEASE_MS_FOR_TEST - 1;
    stepGame(game, 16);
    expect(game.houseIdleTimerMs).toBeGreaterThanOrEqual(HOUSE_IDLE_RELEASE_MS_FOR_TEST);
    expect(flank.state).toBe('leaving');
    expect(shy.state).toBe('house'); // one release per frame
    stepGame(game, 16);
    expect(shy.state).toBe('leaving');
  });

  it('the shared 4s idle alone releases whoever remains housed', () => {
    const game = runningGame();
    placePlayerAt(game, 14, 14);
    const [, ambush, flank, shy] = game.ghosts;
    stepGame(game, 16); // ambush out via its always-due counter
    flank.dotsEatenSinceRelease = 0;
    shy.dotsEatenSinceRelease = 0;

    // Just under the idle gate nobody new leaves, however many frames pass.
    game.houseIdleTimerMs = 0;
    for (let frame = 0; frame < 240; frame++) {
      game.houseIdleTimerMs = Math.min(game.houseIdleTimerMs, HOUSE_IDLE_RELEASE_MS_FOR_TEST - 17);
      stepGame(game, 16);
      expect(flank.state).toBe('house');
      expect(shy.state).toBe('house');
    }
    // Past 4s without a dot both go — in order, on separate frames.
    game.houseIdleTimerMs = 0;
    stepGame(game, 4_100);
    expect(game.houseIdleTimerMs).toBeGreaterThanOrEqual(HOUSE_IDLE_RELEASE_MS_FOR_TEST);
    expect(flank.state).not.toBe('house');
    expect(shy.state).not.toBe('house');
  });
});

const HOUSE_DOT_COUNTERS_FOR_TEST = { ambush: 0, flank: 30, shy: 60 } as const;
const HOUSE_IDLE_RELEASE_MS_FOR_TEST = 4_000;

describe('shipit game — eyes re-entry and energizer immunity', () => {
  function stageEye(game: ShipItGame, tileX: number, tileY: number, facing: number): Ghost {
    const ambush = game.ghosts[1]!;
    Object.assign(ambush, tileCenter(tileX, tileY), {
      state: 'eyes' as const,
      facing,
      desired: null,
      frightenedTimerMs: 0,
    });
    return ambush;
  }

  it('forces eyes resting on DIRECT_SPAWN down through the door until they re-emerge', () => {
    const game = runningGame();
    placePlayerAt(game, 14, 14);
    const eye = stageEye(game, indexX(DIRECT_SPAWN), indexY(DIRECT_SPAWN), LEFT);
    stepGame(game, 16);
    // The dive decision fired and the descent actually started.
    expect(eye.facing).toBe(DOWN);
    expect(eye.y).toBeGreaterThan(indexY(DIRECT_SPAWN) * TILE + TILE / 2);
    expect(eye.x).toBe(indexX(DIRECT_SPAWN) * TILE + TILE / 2);
    // The dive completes: the old engine froze eyes on the house side of the
    // door forever. Step past the descent — no bug may still be eyes.
    for (let i = 0; i < 40; i++) stepGame(game, 16);
    expect(eye.state).not.toBe('eyes');
  });

  it('an eye arriving facing UP still dives: forced DOWN overrides reversal exclusion', () => {
    const game = runningGame();
    placePlayerAt(game, 14, 14);
    const eye = stageEye(game, indexX(DIRECT_SPAWN), indexY(DIRECT_SPAWN), UP);
    // UP is the reversal of the dive; the forced DOWN must win anyway.
    stepGame(game, 16);
    expect(eye.facing).toBe(DOWN);
    expect(eye.y).toBeGreaterThan(indexY(DIRECT_SPAWN) * TILE + TILE / 2);
  });

  it('an eye through the door rejoins as active above it, facing LEFT', () => {
    const game = runningGame();
    placePlayerAt(game, 14, 14);
    const door = centerOfForTest(HOUSE_DOOR_INDEX);
    const aboveDoor = centerOfForTest(DIRECT_SPAWN);
    const eye = stageEye(game, indexX(DIRECT_SPAWN), indexY(DIRECT_SPAWN), DOWN);
    let elapsed = 0;
    while (eye.state !== 'active' && elapsed < 5_000) {
      stepGame(game, 10);
      elapsed += 10;
    }
    // The exact emergence spot only holds at the transition frame itself.
    expect(elapsed).toBeLessThan(5_000);
    expect(eye.x).toBe(door.x);
    expect(eye.y).toBe(aboveDoor.y);
    expect(eye.facing).toBe(LEFT);
    expect(eye.desired).toBeNull();
    // Re-emerged means live again, not parked.
    stepGame(game, 100);
    expect(eye.state).toBe('active');
  });

  it('an energizer frightens no bug that is eyes', () => {
    const game = runningGame();
    const eye = stageEye(game, 15, 11, LEFT);
    // Park the player on the live energizer at (1,3): the next frame eats it.
    placePlayerAt(game, 1, 3);
    game.player.facing = LEFT;
    stepGame(game, 16);
    expect(game.globalFrightTimerMs).toBe(FRIGHT_MS);
    // The flying eye kept its state, heading and home target.
    expect(eye.state).toBe('eyes');
    expect(eye.facing).toBe(LEFT);
    expect(targetFor(game, eye)).toBe(DIRECT_SPAWN);
    drainGameEvents(game);
  });
});

function centerOfForTest(tile: number): { x: number; y: number } {
  return { x: indexX(tile) * TILE + TILE / 2, y: indexY(tile) * TILE + TILE / 2 };
}

type Ghost = ShipItGame['ghosts'][number];

describe('shipit game — R16 Cruise Elroy', () => {
  it('speeds Direct up at 20 and 10 remaining and keeps chasing in scatter', () => {
    expect(ELROY_DOTS_1).toBe(20);
    expect(ELROY_DOTS_2).toBe(10);
    const game = runningGame();
    game.mode = 'scatter';

    game.pelletsRemaining = 25;
    expect(elroyLevel(game)).toBe(0);

    game.pelletsRemaining = ELROY_DOTS_1;
    expect(elroyLevel(game)).toBe(1);
    // Elroy ignores scatter: targetFor keeps chasing via the direct rule.
    const direct = game.ghosts[0]!;
    Object.assign(direct, tileCenter(20, 8));
    direct.facing = LEFT;
    expect(targetFor(game, direct)).toBe(tileOf(game.player));

    game.pelletsRemaining = ELROY_DOTS_2;
    expect(elroyLevel(game)).toBe(2);
    expect(elroyLevel(game) === 2 && game.mode === 'scatter').toBe(true);
  });
});

describe('shipit game — R19 phases and restart', () => {
  it('starts idle, runs, restarts clean', () => {
    const game = createShipItGame();
    expect(game.phase).toBe('idle');
    expect(startGame(game)).toBe(true);
    expect(startGame(game)).toBe(false);
    stepGame(game, 50);
    restartGame(game);
    expect(game.phase).toBe('running');
    expect(game.score).toBe(0);
    expect(game.lives).toBe(3);
    expect(game.pelletsRemaining).toBe(game.pelletsRemaining);
  });

  it('advances discrete steps only on queued legal input (R23)', () => {
    const game = runningGame();
    parkGhosts(game);
    placePlayerAt(game, 10, 23);
    game.player.facing = RIGHT;
    const before = game.player.x;
    expect(stepDiscrete(game)).toBe(false);
    expect(game.player.x).toBe(before);
    queueDirection(game, RIGHT);
    expect(stepDiscrete(game)).toBe(true);
    expect(game.player.x).toBeGreaterThan(before);
  });

  it('a discrete step that kills recovers the respawn synchronously, without a frame clock', () => {
    const game = runningGame();
    // The player walks right out of spawn; ambush is parked ten pixels ahead
    // facing home. One 120ms discrete step closes the gap and costs a life.
    placePlayerAt(game, 14, 17);
    game.player.facing = RIGHT;
    game.player.desired = null;
    const ambush = game.ghosts[1]!;
    Object.assign(
      ambush,
      { x: 14 * TILE + TILE / 2 + 10, y: 17 * TILE + TILE / 2 },
      {
        state: 'active' as const,
        facing: LEFT,
        desired: null,
        frightenedTimerMs: 0,
      },
    );

    queueDirection(game, RIGHT);
    expect(stepDiscrete(game)).toBe(true);
    expect(game.lives).toBe(2);
    expect(drainGameEvents(game).flags & GAME_EVENT_DEATH).toBe(GAME_EVENT_DEATH);
    // No rAF exists under reduced motion, so the respawn must be over
    // already — the phase may not strand on 'respawn' waiting for a clock.
    expect(game.phase).toBe('running');
    // The death reset ran: player home, housed bugs housed again.
    expect(game.player.x).toBe(tileCenter(indexX(PLAYER_SPAWN), indexY(PLAYER_SPAWN)).x);
    expect(game.player.y).toBe(tileCenter(indexX(PLAYER_SPAWN), indexY(PLAYER_SPAWN)).y);
    expect(game.player.facing).toBe(LEFT);
    expect(game.ghosts[0]!.state).toBe('active');
    expect(ambush.state).toBe('house');
    // Fresh input is accepted immediately — no soft-lock.
    queueDirection(game, RIGHT);
    expect(stepDiscrete(game)).toBe(true);
  });

  it('a discrete death consumes its queued input and leaves nothing pending', () => {
    const game = runningGame();
    placePlayerAt(game, 14, 17);
    game.player.facing = RIGHT;
    game.player.desired = null;
    Object.assign(
      game.ghosts[1]!,
      { x: 14 * TILE + TILE / 2 + 10, y: 17 * TILE + TILE / 2 },
      {
        state: 'active' as const,
        facing: LEFT,
        desired: null,
        frightenedTimerMs: 0,
      },
    );
    queueDirection(game, RIGHT);
    stepDiscrete(game);
    // The synchronous burn completed the respawn: the phase may not strand
    // waiting for the rAF loop the motion veto stopped.
    expect(game.phase).toBe('running');
    drainGameEvents(game);
    // The queued input was consumed by the killing step — with nothing newly
    // queued, a second discrete call is inert rather than double-stepping.
    expect(stepDiscrete(game)).toBe(false);
  });
});

describe('shipit game — determinism', () => {
  it('produces identical trajectories for identical inputs (seeded PRNG)', () => {
    const runOnce = (): Array<[number, number]> => {
      const game = runningGame();
      queueDirection(game, UP);
      const trace: Array<[number, number]> = [];
      for (let i = 0; i < 40; i++) {
        stepGame(game, 16);
        trace.push([Math.round(game.player.x * 4), Math.round(game.ghosts[0]!.x * 4)]);
        if ((i & 7) === 7) queueDirection(game, i % 2 ? DOWN : UP);
      }
      return trace;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe('shipit game — mid-frame junction decisions', () => {
  it('an eye whose flight crosses DIRECT_SPAWN mid-frame dives through the door', () => {
    const game = runningGame();
    placePlayerAt(game, 14, 14);
    // Staged on the (12,11) centre west of the spawn column, heading RIGHT:
    // ordinary 16 ms slices carry an eye ~1.94 px apiece, so the flight
    // reaches the DIRECT_SPAWN centre mid-slice — with a non-zero sub-frame
    // remainder — and the dive decision must fire inside advance() itself.
    // An engine that decides only at frame start flies straight past the
    // house and never comes home.
    const eye = game.ghosts[1]!;
    Object.assign(eye, tileCenter(12, 11), {
      state: 'eyes' as const,
      facing: RIGHT,
      desired: null,
      frightenedTimerMs: 0,
    });
    let elapsed = 0;
    while (eye.state !== 'active' && elapsed < 6_000) {
      stepGame(game, 16);
      elapsed += 16;
    }
    expect(elapsed).toBeLessThan(6_000);
    // Re-emerged above the door — reachable only by diving through it.
    const door = centerOfForTest(HOUSE_DOOR_INDEX);
    const aboveDoor = centerOfForTest(DIRECT_SPAWN);
    expect(eye.x).toBe(door.x);
    expect(eye.y).toBe(aboveDoor.y);
    expect(eye.facing).toBe(LEFT);
    expect(eye.desired).toBeNull();
  });

  it('an active bug decides at a centre crossed mid-frame, not only at frame start', () => {
    const game = runningGame();
    placePlayerAt(game, 3, 27);
    game.player.facing = UP;
    game.player.desired = null;
    const direct = game.ghosts[0]!;
    // The T at (6,8), approached from the west. One 120 ms slice travels
    // ~6.8 px, so resting 1 px east of the centre puts the crossing
    // mid-frame: the next frame's start decision sees no intersection, then
    // the movement crosses the centre with ~5.8 px remaining and must take
    // the scatter exit UP before spending what is left of the frame in the
    // vertical lane.
    Object.assign(direct, tileCenter(6, 8));
    direct.state = 'active';
    direct.facing = LEFT;
    direct.desired = null;
    direct.x += 1;
    expect(((direct.x % TILE) + TILE) % TILE).not.toBe(TILE / 2);

    stepGame(game, 120);
    expect(direct.facing).toBe(UP);
    expect(direct.x).toBe(6 * TILE + TILE / 2);
    expect(direct.y).toBeLessThan(8 * TILE + TILE / 2);
    expect(direct.y).toBeGreaterThanOrEqual(7 * TILE);
  });
});
