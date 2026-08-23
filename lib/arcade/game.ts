import { h } from '../pixel';
import {
  BOARD_SIZE,
  CUTLINE_SPAWN,
  DIRECT_SPAWN,
  DRIFT_SPAWN,
  INITIAL_READING_COUNT,
  PLAYER_SPAWN,
  createReadings,
  indexX,
  indexY,
  isWalkable,
  neighbourIndex,
} from './layout';

export type Direction = 0 | 1 | 2 | 3;
export const UP: Direction = 0;
export const DOWN: Direction = 1;
export const LEFT: Direction = 2;
export const RIGHT: Direction = 3;
export const NO_DIRECTION = -1;

const DIRECTION_X = new Int8Array([0, 0, -1, 1]);
const DIRECTION_Y = new Int8Array([-1, 1, 0, 0]);

export const PLAYER_PERIOD_MS = 110;
export const DIRECT_PERIOD_MS = 190;
export const CUTLINE_PERIOD_MS = 210;
export const DRIFT_PERIOD_MS = 230;
export const RESPAWN_MS = 900;
const MAX_FRAME_MS = 250;
const MAX_STEPS_PER_FRAME = 12;

export const GAME_EVENT_READING = 1;
export const GAME_EVENT_COLLISION = 2;
export const GAME_EVENT_WON = 4;
export const GAME_EVENT_LOST = 8;
export const GAME_EVENT_PHASE = 16;

export type GamePhase = 'idle' | 'running' | 'respawn' | 'won' | 'lost';
export type PursuerKind = 'direct' | 'cutline' | 'drift';

export type ArcadeMover = {
  cell: number;
  previousCell: number;
  direction: Direction | typeof NO_DIRECTION;
  accumulatorMs: number;
  readonly periodMs: number;
  moves: number;
};

export type ArcadePursuer = ArcadeMover & {
  readonly kind: PursuerKind;
  readonly spawn: number;
};

export type ArcadeGame = {
  phase: GamePhase;
  score: number;
  lives: number;
  readingsRemaining: number;
  readonly readings: Uint8Array<ArrayBuffer>;
  readonly player: ArcadeMover;
  readonly pursuers: readonly [ArcadePursuer, ArcadePursuer, ArcadePursuer];
  queuedDirection: Direction | typeof NO_DIRECTION;
  respawnRemainingMs: number;
  discretePursuer: number;
  events: number;
  eventCell: number;
  readonly bfsQueue: Int16Array<ArrayBuffer>;
  readonly bfsDistance: Int16Array<ArrayBuffer>;
};

export type ArcadeSnapshot = Readonly<{
  phase: GamePhase;
  score: number;
  lives: number;
  readingsRemaining: number;
  initialReadings: number;
}>;

export type ArcadeEventBatch = Readonly<{
  flags: number;
  cell: number;
}>;

function createMover(cell: number, periodMs: number, direction: Direction | -1): ArcadeMover {
  return {
    cell,
    previousCell: cell,
    direction,
    accumulatorMs: 0,
    periodMs,
    moves: 0,
  };
}

function createPursuer(
  kind: PursuerKind,
  spawn: number,
  periodMs: number,
  direction: Direction,
): ArcadePursuer {
  return {
    ...createMover(spawn, periodMs, direction),
    kind,
    spawn,
  };
}

export function createArcadeGame(): ArcadeGame {
  return {
    phase: 'idle',
    score: 0,
    lives: 3,
    readingsRemaining: INITIAL_READING_COUNT,
    readings: createReadings(),
    player: createMover(PLAYER_SPAWN, PLAYER_PERIOD_MS, NO_DIRECTION),
    pursuers: [
      createPursuer('direct', DIRECT_SPAWN, DIRECT_PERIOD_MS, UP),
      createPursuer('cutline', CUTLINE_SPAWN, CUTLINE_PERIOD_MS, LEFT),
      createPursuer('drift', DRIFT_SPAWN, DRIFT_PERIOD_MS, LEFT),
    ],
    queuedDirection: NO_DIRECTION,
    respawnRemainingMs: 0,
    discretePursuer: 0,
    events: 0,
    eventCell: -1,
    bfsQueue: new Int16Array(BOARD_SIZE),
    bfsDistance: new Int16Array(BOARD_SIZE),
  };
}

function resetMover(mover: ArcadeMover, cell: number, direction: Direction | -1): void {
  mover.cell = cell;
  mover.previousCell = cell;
  mover.direction = direction;
  mover.accumulatorMs = 0;
  mover.moves = 0;
}

function resetPositions(game: ArcadeGame): void {
  resetMover(game.player, PLAYER_SPAWN, NO_DIRECTION);
  resetMover(game.pursuers[0], DIRECT_SPAWN, UP);
  resetMover(game.pursuers[1], CUTLINE_SPAWN, LEFT);
  resetMover(game.pursuers[2], DRIFT_SPAWN, LEFT);
  game.queuedDirection = NO_DIRECTION;
  game.discretePursuer = 0;
}

export function startGame(game: ArcadeGame): boolean {
  if (game.phase !== 'idle') return false;
  game.phase = 'running';
  game.events |= GAME_EVENT_PHASE;
  return true;
}

export function restartGame(game: ArcadeGame): void {
  game.readings.set(createReadings());
  game.phase = 'running';
  game.score = 0;
  game.lives = 3;
  game.readingsRemaining = INITIAL_READING_COUNT;
  game.respawnRemainingMs = 0;
  game.events = GAME_EVENT_PHASE;
  game.eventCell = -1;
  resetPositions(game);
}

export function queueDirection(game: ArcadeGame, direction: Direction): boolean {
  if (game.phase !== 'running') return false;
  game.queuedDirection = direction;
  return true;
}

function opposite(direction: Direction): Direction {
  return (direction ^ 1) as Direction;
}

function neighbourInDirection(index: number, direction: Direction): number {
  return neighbourIndex(index, DIRECTION_X[direction]!, DIRECTION_Y[direction]!);
}

function moveTo(mover: ArcadeMover, next: number, direction: Direction): void {
  mover.previousCell = mover.cell;
  mover.cell = next;
  mover.direction = direction;
  mover.moves++;
}

function clearReading(game: ArcadeGame): void {
  const cell = game.player.cell;
  if (!game.readings[cell]) return;
  game.readings[cell] = 0;
  game.readingsRemaining--;
  game.score += 10;
  game.eventCell = cell;
  game.events |= GAME_EVENT_READING;

  if (game.readingsRemaining === 0) {
    game.phase = 'won';
    game.events |= GAME_EVENT_WON | GAME_EVENT_PHASE;
  }
}

function movedThroughEachOther(a: ArcadeMover, b: ArcadeMover): boolean {
  return a.previousCell === b.cell && a.cell === b.previousCell;
}

function colliding(game: ArcadeGame): boolean {
  for (let i = 0; i < game.pursuers.length; i++) {
    const pursuer = game.pursuers[i]!;
    if (game.player.cell === pursuer.cell || movedThroughEachOther(game.player, pursuer)) return true;
  }
  return false;
}

function handleCollision(game: ArcadeGame, discrete: boolean): void {
  game.lives--;
  game.events |= GAME_EVENT_COLLISION | GAME_EVENT_PHASE;
  resetPositions(game);

  if (game.lives <= 0) {
    game.phase = 'lost';
    game.events |= GAME_EVENT_LOST;
    game.respawnRemainingMs = 0;
    return;
  }

  if (discrete) {
    game.phase = 'running';
    game.respawnRemainingMs = 0;
  } else {
    game.phase = 'respawn';
    game.respawnRemainingMs = RESPAWN_MS;
  }
}

function movePlayer(game: ArcadeGame, discrete: boolean): boolean {
  let direction = game.player.direction;
  if (game.queuedDirection !== NO_DIRECTION) {
    const queuedNext = neighbourInDirection(game.player.cell, game.queuedDirection);
    if (queuedNext >= 0) {
      direction = game.queuedDirection;
      game.queuedDirection = NO_DIRECTION;
    } else if (discrete) {
      game.queuedDirection = NO_DIRECTION;
      return false;
    }
  }

  if (direction === NO_DIRECTION) return false;
  const next = neighbourInDirection(game.player.cell, direction);
  if (next < 0) {
    game.player.direction = NO_DIRECTION;
    return false;
  }

  moveTo(game.player, next, direction);
  clearReading(game);
  if (game.phase === 'won') return true;
  if (colliding(game)) handleCollision(game, discrete);
  return true;
}

function buildDistanceField(game: ArcadeGame, target: number): void {
  const distance = game.bfsDistance;
  const queue = game.bfsQueue;
  distance.fill(-1);
  distance[target] = 0;
  queue[0] = target;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const cell = queue[head++]!;
    const nextDistance = distance[cell]! + 1;
    for (let direction = 0; direction < 4; direction++) {
      const next = neighbourInDirection(cell, direction as Direction);
      if (next < 0 || distance[next]! >= 0) continue;
      distance[next] = nextDistance;
      queue[tail++] = next;
    }
  }
}

function chooseToward(game: ArcadeGame, mover: ArcadeMover, target: number): Direction | -1 {
  buildDistanceField(game, target);
  let bestDirection: Direction | -1 = NO_DIRECTION;
  let bestDistance = 32767;
  for (let direction = 0; direction < 4; direction++) {
    const next = neighbourInDirection(mover.cell, direction as Direction);
    if (next < 0) continue;
    const distance = game.bfsDistance[next]!;
    if (distance >= 0 && distance < bestDistance) {
      bestDistance = distance;
      bestDirection = direction as Direction;
    }
  }
  return bestDirection;
}

function cutlineTarget(game: ArcadeGame): number {
  if (game.player.direction === NO_DIRECTION) return game.player.cell;
  let target = game.player.cell;
  for (let step = 0; step < 3; step++) {
    const next = neighbourInDirection(target, game.player.direction);
    if (next < 0) break;
    target = next;
  }
  return target;
}

function chooseDrift(mover: ArcadeMover): Direction | -1 {
  const reverse = mover.direction === NO_DIRECTION ? NO_DIRECTION : opposite(mover.direction);
  let candidates = 0;
  for (let direction = 0; direction < 4; direction++) {
    if (direction === reverse) continue;
    if (neighbourInDirection(mover.cell, direction as Direction) >= 0) candidates++;
  }

  if (candidates === 0) {
    return reverse !== NO_DIRECTION && neighbourInDirection(mover.cell, reverse) >= 0
      ? reverse
      : NO_DIRECTION;
  }

  const choice = Math.floor(
    h(indexX(mover.cell) + mover.moves * 17.17, indexY(mover.cell) + mover.moves * 31.31) * candidates,
  );
  let seen = 0;
  for (let direction = 0; direction < 4; direction++) {
    if (direction === reverse) continue;
    if (neighbourInDirection(mover.cell, direction as Direction) < 0) continue;
    if (seen === choice) return direction as Direction;
    seen++;
  }
  return NO_DIRECTION;
}

function movePursuer(game: ArcadeGame, index: number, discrete: boolean): boolean {
  const pursuer = game.pursuers[index]!;
  let direction: Direction | -1;
  if (pursuer.kind === 'direct') {
    direction = chooseToward(game, pursuer, game.player.cell);
  } else if (pursuer.kind === 'cutline') {
    direction = chooseToward(game, pursuer, cutlineTarget(game));
  } else {
    direction = chooseDrift(pursuer);
  }

  if (direction === NO_DIRECTION) return false;
  const next = neighbourInDirection(pursuer.cell, direction);
  if (next < 0) return false;
  moveTo(pursuer, next, direction);
  if (colliding(game)) handleCollision(game, discrete);
  return true;
}

export function stepTurn(game: ArcadeGame): boolean {
  if (game.phase !== 'running' || game.queuedDirection === NO_DIRECTION) return false;
  const livesBeforeMove = game.lives;
  if (!movePlayer(game, true)) return false;
  if (game.phase !== 'running' || game.lives !== livesBeforeMove) return true;

  const pursuer = game.discretePursuer;
  game.discretePursuer = (game.discretePursuer + 1) % game.pursuers.length;
  movePursuer(game, pursuer, true);
  return true;
}

export function stepGame(game: ArcadeGame, deltaMs: number): boolean {
  if (game.phase === 'idle' || game.phase === 'won' || game.phase === 'lost') return false;
  const elapsed = Math.max(0, Math.min(deltaMs, MAX_FRAME_MS));

  if (game.phase === 'respawn') {
    game.respawnRemainingMs = Math.max(0, game.respawnRemainingMs - elapsed);
    if (game.respawnRemainingMs === 0) {
      game.phase = 'running';
      game.events |= GAME_EVENT_PHASE;
      return true;
    }
    return false;
  }

  game.player.accumulatorMs += elapsed;
  for (let i = 0; i < game.pursuers.length; i++) game.pursuers[i]!.accumulatorMs += elapsed;

  let changed = false;
  let steps = 0;
  while (steps < MAX_STEPS_PER_FRAME && game.phase === 'running') {
    let advanced = false;
    if (game.player.accumulatorMs >= game.player.periodMs) {
      game.player.accumulatorMs -= game.player.periodMs;
      changed = movePlayer(game, false) || changed;
      advanced = true;
      steps++;
      if (game.phase !== 'running') break;
    }

    for (let i = 0; i < game.pursuers.length && steps < MAX_STEPS_PER_FRAME; i++) {
      const pursuer = game.pursuers[i]!;
      if (pursuer.accumulatorMs < pursuer.periodMs) continue;
      pursuer.accumulatorMs -= pursuer.periodMs;
      changed = movePursuer(game, i, false) || changed;
      advanced = true;
      steps++;
      if (game.phase !== 'running') break;
    }
    if (!advanced) break;
  }
  return changed;
}

export function snapshotGame(game: ArcadeGame): ArcadeSnapshot {
  return {
    phase: game.phase,
    score: game.score,
    lives: game.lives,
    readingsRemaining: game.readingsRemaining,
    initialReadings: INITIAL_READING_COUNT,
  };
}

export function drainGameEvents(game: ArcadeGame): ArcadeEventBatch {
  const batch = { flags: game.events, cell: game.eventCell };
  game.events = 0;
  game.eventCell = -1;
  return batch;
}

export function directionFromKey(key: string): Direction | null {
  switch (key.toLowerCase()) {
    case 'arrowup':
    case 'w':
      return UP;
    case 'arrowdown':
    case 's':
      return DOWN;
    case 'arrowleft':
    case 'a':
      return LEFT;
    case 'arrowright':
    case 'd':
      return RIGHT;
    default:
      return null;
  }
}

export function pathDistance(game: ArcadeGame, from: number, to: number): number {
  if (!isWalkable(from) || !isWalkable(to)) return -1;
  buildDistanceField(game, to);
  return game.bfsDistance[from]!;
}
