import { describe, expect, it } from 'vitest';
import {
  CUTLINE_PERIOD_MS,
  DIRECT_PERIOD_MS,
  DOWN,
  DRIFT_PERIOD_MS,
  GAME_EVENT_COLLISION,
  GAME_EVENT_LOST,
  GAME_EVENT_READING,
  GAME_EVENT_WON,
  LEFT,
  NO_DIRECTION,
  PLAYER_PERIOD_MS,
  RESPAWN_MS,
  RIGHT,
  UP,
  createArcadeGame,
  directionFromKey,
  drainGameEvents,
  pathDistance,
  queueDirection,
  restartGame,
  snapshotGame,
  startGame,
  stepGame,
  stepTurn,
  type ArcadeGame,
  type Direction,
} from './game';
import {
  CUTLINE_SPAWN,
  DIRECT_SPAWN,
  DRIFT_SPAWN,
  INITIAL_READING_COUNT,
  PLAYER_SPAWN,
  createReadings,
  indexX,
  indexY,
  neighbourIndex,
  toIndex,
} from './layout';

function runningGame(): ArcadeGame {
  const game = createArcadeGame();
  expect(startGame(game)).toBe(true);
  drainGameEvents(game);
  return game;
}

function stopAutomaticMovement(game: ArcadeGame): void {
  game.player.accumulatorMs = -10_000;
  for (const pursuer of game.pursuers) pursuer.accumulatorMs = -10_000;
}

function placeCollisionOneCellRight(game: ArcadeGame): void {
  const target = neighbourIndex(PLAYER_SPAWN, 1, 0);
  game.pursuers[0].cell = target;
  game.pursuers[0].previousCell = target;
  game.pursuers[1].cell = CUTLINE_SPAWN;
  game.pursuers[1].previousCell = CUTLINE_SPAWN;
  game.pursuers[2].cell = DRIFT_SPAWN;
  game.pursuers[2].previousCell = DRIFT_SPAWN;
}

function snapshotWithPositions(game: ArcadeGame) {
  return {
    ...snapshotGame(game),
    player: [game.player.cell, game.player.previousCell, game.player.direction, game.player.moves],
    pursuers: game.pursuers.map((pursuer) => [
      pursuer.cell,
      pursuer.previousCell,
      pursuer.direction,
      pursuer.moves,
    ]),
    readings: Array.from(game.readings),
  };
}

describe('arcade game', () => {
  it('starts idle and maps only the documented keys', () => {
    const game = createArcadeGame();
    expect(snapshotGame(game)).toEqual({
      phase: 'idle',
      score: 0,
      lives: 3,
      readingsRemaining: INITIAL_READING_COUNT,
      initialReadings: INITIAL_READING_COUNT,
    });
    expect(directionFromKey('ArrowUp')).toBe(UP);
    expect(directionFromKey('s')).toBe(DOWN);
    expect(directionFromKey('A')).toBe(LEFT);
    expect(directionFromKey('d')).toBe(RIGHT);
    expect(directionFromKey('Enter')).toBeNull();
    expect(queueDirection(game, RIGHT)).toBe(false);
    expect(startGame(game)).toBe(true);
    expect(startGame(game)).toBe(false);
  });

  it('honours the player period and scores one reading per cell', () => {
    const game = runningGame();
    queueDirection(game, RIGHT);
    expect(stepGame(game, PLAYER_PERIOD_MS - 1)).toBe(false);
    expect(game.player.cell).toBe(PLAYER_SPAWN);
    expect(stepGame(game, 1)).toBe(true);
    expect(indexX(game.player.cell)).toBe(indexX(PLAYER_SPAWN) + 1);
    expect(game.score).toBe(10);
    expect(game.readingsRemaining).toBe(INITIAL_READING_COUNT - 1);
    expect(drainGameEvents(game).flags & GAME_EVENT_READING).toBeTruthy();
  });

  it('buffers a blocked turn until the first legal intersection', () => {
    const game = runningGame();
    queueDirection(game, RIGHT);
    stepGame(game, PLAYER_PERIOD_MS);
    queueDirection(game, DOWN);
    stepGame(game, PLAYER_PERIOD_MS);
    expect(indexX(game.player.cell)).toBe(3);
    expect(indexY(game.player.cell)).toBe(1);
    expect(game.queuedDirection).toBe(DOWN);
    stepGame(game, PLAYER_PERIOD_MS);
    expect(indexX(game.player.cell)).toBe(4);
    expect(indexY(game.player.cell)).toBe(1);
    stepGame(game, PLAYER_PERIOD_MS);
    expect(indexX(game.player.cell)).toBe(4);
    expect(indexY(game.player.cell)).toBe(2);
    expect(game.player.direction).toBe(DOWN);
    expect(game.queuedDirection).toBe(NO_DIRECTION);
  });

  it('is deterministic for an identical timing and input sequence', () => {
    const first = runningGame();
    const second = runningGame();
    const sequence: ReadonlyArray<readonly [number, Direction | null]> = [
      [110, RIGHT],
      [80, DOWN],
      [140, null],
      [230, RIGHT],
      [250, UP],
      [90, null],
    ];

    for (const [delta, direction] of sequence) {
      if (direction !== null) {
        queueDirection(first, direction);
        queueDirection(second, direction);
      }
      stepGame(first, delta);
      stepGame(second, delta);
    }
    expect(snapshotWithPositions(first)).toEqual(snapshotWithPositions(second));
  });

  it('detects a same-cell collision and performs an immediate discrete reset', () => {
    const game = runningGame();
    placeCollisionOneCellRight(game);
    queueDirection(game, RIGHT);
    expect(stepTurn(game)).toBe(true);
    expect(game.lives).toBe(2);
    expect(game.phase).toBe('running');
    expect(game.player.cell).toBe(PLAYER_SPAWN);
    expect(game.pursuers[0].cell).toBe(DIRECT_SPAWN);
    expect(drainGameEvents(game).flags & GAME_EVENT_COLLISION).toBeTruthy();
  });

  it('detects entities swapping cells', () => {
    const game = runningGame();
    const target = neighbourIndex(PLAYER_SPAWN, 1, 0);
    game.pursuers[0].cell = PLAYER_SPAWN;
    game.pursuers[0].previousCell = target;
    queueDirection(game, RIGHT);
    stepTurn(game);
    expect(game.lives).toBe(2);
    expect(game.player.cell).toBe(PLAYER_SPAWN);
  });

  it('keeps a live collision in respawn for exactly 900 simulated milliseconds', () => {
    const game = runningGame();
    placeCollisionOneCellRight(game);
    queueDirection(game, RIGHT);
    stepGame(game, PLAYER_PERIOD_MS);
    expect(game.phase).toBe('respawn');
    expect(game.respawnRemainingMs).toBe(RESPAWN_MS);
    expect(queueDirection(game, RIGHT)).toBe(false);

    stepGame(game, 250);
    stepGame(game, 250);
    stepGame(game, 250);
    stepGame(game, 149);
    expect(game.phase).toBe('respawn');
    expect(game.respawnRemainingMs).toBe(1);
    stepGame(game, 1);
    expect(game.phase).toBe('running');
  });

  it('gives the final reading precedence over a collision', () => {
    const game = runningGame();
    game.readings.fill(0);
    const finalCell = neighbourIndex(PLAYER_SPAWN, 1, 0);
    game.readings[finalCell] = 1;
    game.readingsRemaining = 1;
    game.pursuers[0].cell = finalCell;
    game.pursuers[0].previousCell = finalCell;
    queueDirection(game, RIGHT);
    stepTurn(game);
    expect(game.phase).toBe('won');
    expect(game.lives).toBe(3);
    expect(game.readingsRemaining).toBe(0);
    const flags = drainGameEvents(game).flags;
    expect(flags & GAME_EVENT_WON).toBeTruthy();
    expect(flags & GAME_EVENT_COLLISION).toBeFalsy();
  });

  it('loses on the third collision and restarts without stale state', () => {
    const game = runningGame();
    for (let collision = 0; collision < 3; collision++) {
      placeCollisionOneCellRight(game);
      queueDirection(game, RIGHT);
      stepTurn(game);
    }
    expect(game.phase).toBe('lost');
    expect(game.lives).toBe(0);
    expect(drainGameEvents(game).flags & GAME_EVENT_LOST).toBeTruthy();

    restartGame(game);
    expect(snapshotGame(game)).toEqual({
      phase: 'running',
      score: 0,
      lives: 3,
      readingsRemaining: INITIAL_READING_COUNT,
      initialReadings: INITIAL_READING_COUNT,
    });
    expect(game.player.cell).toBe(PLAYER_SPAWN);
    expect(game.queuedDirection).toBe(NO_DIRECTION);
    expect(game.respawnRemainingMs).toBe(0);
    expect(game.readings).toEqual(createReadings());
    expect(game.discretePursuer).toBe(0);
    expect(game.eventCell).toBe(-1);
    expect(game.player.accumulatorMs).toBe(0);
    expect(game.player.moves).toBe(0);
    expect(game.pursuers.map((pursuer) => pursuer.cell)).toEqual([
      DIRECT_SPAWN,
      CUTLINE_SPAWN,
      DRIFT_SPAWN,
    ]);
    expect(game.pursuers.map((pursuer) => pursuer.direction)).toEqual([UP, LEFT, LEFT]);
    expect(game.pursuers.map((pursuer) => pursuer.accumulatorMs)).toEqual([0, 0, 0]);
    expect(game.pursuers.map((pursuer) => pursuer.moves)).toEqual([0, 0, 0]);
  });

  it('moves Direct closer to the current player cell', () => {
    const game = runningGame();
    stopAutomaticMovement(game);
    const before = pathDistance(game, game.pursuers[0].cell, game.player.cell);
    game.pursuers[0].accumulatorMs = DIRECT_PERIOD_MS;
    stepGame(game, 0);
    const after = pathDistance(game, game.pursuers[0].cell, game.player.cell);
    expect(after).toBe(before - 1);
  });

  it('lets Direct reverse to catch an adjacent player', () => {
    const game = runningGame();
    stopAutomaticMovement(game);
    const direct = game.pursuers[0];
    direct.cell = neighbourIndex(PLAYER_SPAWN, 1, 0);
    direct.previousCell = direct.cell;
    direct.direction = RIGHT;
    direct.accumulatorMs = DIRECT_PERIOD_MS;
    stepGame(game, 0);
    expect(game.lives).toBe(2);
    expect(game.phase).toBe('respawn');
    expect(drainGameEvents(game).flags & GAME_EVENT_COLLISION).toBeTruthy();
  });

  it('makes Cutline choose a different route toward three cells ahead', () => {
    const playerCell = toIndex(23, 4);
    const pursuerCell = toIndex(13, 3);

    const direct = runningGame();
    stopAutomaticMovement(direct);
    direct.player.cell = playerCell;
    direct.player.previousCell = playerCell;
    direct.player.direction = UP;
    direct.pursuers[0].cell = pursuerCell;
    direct.pursuers[0].previousCell = pursuerCell;
    direct.pursuers[0].direction = UP;
    direct.pursuers[0].accumulatorMs = DIRECT_PERIOD_MS;
    stepGame(direct, 0);

    const cutline = runningGame();
    stopAutomaticMovement(cutline);
    cutline.player.cell = playerCell;
    cutline.player.previousCell = playerCell;
    cutline.player.direction = UP;
    cutline.pursuers[1].cell = pursuerCell;
    cutline.pursuers[1].previousCell = pursuerCell;
    cutline.pursuers[1].direction = UP;
    cutline.pursuers[1].accumulatorMs = CUTLINE_PERIOD_MS;
    stepGame(cutline, 0);

    expect([indexX(direct.pursuers[0].cell), indexY(direct.pursuers[0].cell)]).toEqual([14, 3]);
    expect([indexX(cutline.pursuers[1].cell), indexY(cutline.pursuers[1].cell)]).toEqual([13, 2]);
  });

  it('makes Drift reverse only when a dead end leaves no alternative', () => {
    const game = runningGame();
    stopAutomaticMovement(game);
    const drift = game.pursuers[2];
    drift.cell = toIndex(5, 13);
    drift.previousCell = drift.cell;
    drift.direction = LEFT;
    drift.accumulatorMs = DRIFT_PERIOD_MS;
    stepGame(game, 0);
    expect([indexX(drift.cell), indexY(drift.cell)]).toEqual([6, 13]);
    expect(drift.direction).toBe(RIGHT);
  });

  it('advances one round-robin pursuer per legal discrete turn and none for a block', () => {
    const game = runningGame();
    queueDirection(game, LEFT);
    expect(stepTurn(game)).toBe(false);
    expect(game.pursuers.map((pursuer) => pursuer.moves)).toEqual([0, 0, 0]);

    for (let turn = 0; turn < 3; turn++) {
      queueDirection(game, RIGHT);
      expect(stepTurn(game)).toBe(true);
    }
    expect(game.pursuers.map((pursuer) => pursuer.moves)).toEqual([1, 1, 1]);
    expect(game.discretePursuer).toBe(0);
  });
});
