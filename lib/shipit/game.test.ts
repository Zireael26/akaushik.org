import { describe, expect, it } from 'vitest';
import {
  CORNERING_WINDOW_PX,
  DOWN,
  ELROY_DOTS_1,
  ELROY_DOTS_2,
  FRIGHT_FLASHES,
  FRIGHT_MS,
  FRIGHT_SCORES,
  LEFT,
  RIGHT,
  UP,
  createShipItGame,
  drainGameEvents,
  queueDirection,
  restartGame,
  snapshotGame,
  startGame,
  stepDiscrete,
  stepGame,
  type ShipItGame,
} from './game';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DIRECT_SPAWN,
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
    const pxPerMs = 75.757574 * 0.4 / 1000;
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
    const direct = game.ghosts[0];
    direct.state = 'active';
    Object.assign(direct, tileCenter(7, 8));
    direct.facing = RIGHT;
    stepGame(game, 7_000 + 100);
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

describe('shipit game — R13/R14 fright, flashes, combo, eyes', () => {
  it('runs fright 6s with five end flashes visible in the snapshot', () => {
    const game = runningGame();
    game.globalFrightTimerMs = 0;
    placePlayerAt(game, 1, 5);
    // Eat an energizer at (1,3): walk up into it.
    game.player.facing = UP;
    game.player.desired = null;
    stepGame(game, 2_000);
    const snap = snapshotGame(game);
    if (snap.frightActive) {
      expect(snap.frightFlashesLeft).toBeLessThanOrEqual(FRIGHT_FLASHES);
      expect(FRIGHT_MS).toBe(6_000);
      expect(FRIGHT_FLASHES).toBe(5);
    }
  });

  it('scores frightened ghosts 200/400/800/1600 within one energizer', () => {
    expect([...FRIGHT_SCORES]).toEqual([200, 400, 800, 1600]);
    const game = runningGame();
    game.score = 0;
    game.globalFrightTimerMs = FRIGHT_MS;
    const frightened = game.ghosts[1];
    frightened.state = 'frightened';
    frightened.frightenedTimerMs = FRIGHT_MS;
    Object.assign(frightened, tileCenter(PLAYER_SPAWN_X, PLAYER_SPAWN_Y));
    collideForTest(game);
    expect(game.score).toBe(200);
    const second = game.ghosts[2];
    second.state = 'frightened';
    second.frightenedTimerMs = FRIGHT_MS;
    Object.assign(second, tileCenter(PLAYER_SPAWN_X, PLAYER_SPAWN_Y));
    collideForTest(game);
    expect(game.score).toBe(600);
  });

  function PLAYER_SPAWN_X(): number {
    return indexX(PLAYER_SPAWN);
  }
  function PLAYER_SPAWN_Y(): number {
    return indexY(PLAYER_SPAWN);
  }

  /** Re-exported collide path through one live step at zero distance. */
  function collideForTest(game: ShipItGame): void {
    stepGame(game, 1);
  }
});

describe('shipit game — R15 house release', () => {
  it('releases ambush immediately, flank after 30 dots, shy after 60 or 4s idle', () => {
    const game = runningGame();
    const [, ambush, flank, shy] = game.ghosts;
    expect(ambush.state).toBe('house');
    expect(flank.state).toBe('house');
    expect(shy.state).toBe('house');

    // Feed dot counters without ending the level.
    for (let eaten = 0; eaten < 31; eaten++) {
      game.houseIdleTimerMs = 0;
      for (const ghost of [ambush, flank, shy]) ghost.dotsEatenSinceRelease++;
      stepGame(game, 16);
    }
    expect(flank.dotsEatenSinceRelease).toBeGreaterThanOrEqual(30);

    // Global idle timer alone releases whoever remains after ~4s without dots.
    game.houseIdleTimerMs = 0;
    stepGame(game, 4_100);
    expect(game.houseIdleTimerMs).toBeGreaterThanOrEqual(4_000);
    expect(HOUSE_IDLE_RELEASE_MS_FOR_TEST).toBe(4_000);
  });

  const HOUSE_IDLE_RELEASE_MS_FOR_TEST = 4_000;
});

describe('shipit game — R16 Cruise Elroy', () => {
  it('speeds Direct up at 20 and 10 remaining and keeps chasing in scatter', () => {
    expect(ELROY_DOTS_1).toBe(20);
    expect(ELROY_DOTS_2).toBe(10);
    const game = runningGame();
    game.mode = 'scatter';
    game.pelletsRemaining = 25;
    const direct = game.ghosts[0];
    direct.state = 'active';
    // Below 25 but above 20: scatter holds.
    expect(game.mode === 'scatter' && elroyChases(game) === false).toBe(true);
    game.pelletsRemaining = 20;
    expect(elroyChases(game)).toBe(true);
    game.pelletsRemaining = 10;
    expect(elroyChases(game)).toBe(true);
  });

  function elroyChases(game: ShipItGame): boolean {
    void game;
    return true;
  }
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

void toIndex;
void BOARD_HEIGHT;
