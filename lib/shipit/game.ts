/**
 * Ship It engine — a deterministic, pixel-grid maze-chase state machine.
 *
 * No DOM, no React, no canvas, no storage, no audio (spec architecture
 * contract). Actors move on a continuous pixel grid and decide at tile
 * centres; the player alone may begin a turn up to CORNERING_WINDOW_PX
 * before the centre. The scene drains compact events; the engine never
 * calls upward.
 */
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BOARD_SIZE,
  BUG_HOUSE_SEATS,
  DIRECT_SPAWN,
  HOUSE_DOOR_INDEX,
  INITIAL_PELLET_COUNT,
  PLAYER_SPAWN,
  SCATTER_CORNERS,
  TUNNEL_Y,
  createPellets,
  indexX,
  indexY,
  inRedZone,
  inTunnel,
  isHouseTile,
  isWalkable,
  neighbourIndex,
  toIndex,
  type BugKind,
} from './layout';
import {
  DOWN,
  LEFT,
  RIGHT,
  UP,
  ambushTile,
  chooseExit,
  flankTile,
  opposite,
  shyTile,
  step,
  type Direction,
  type Exit,
} from './targeting';

export { DOWN, LEFT, RIGHT, UP };
export type { Direction };

/** Base speed in px/s — the classic level-1 reference pace. */
export const BASE_SPEED_PXS = 75.757574;
const PCT = (percent: number) => (percent / 100) * BASE_SPEED_PXS;

export const PLAYER_SPEED = PCT(80);
export const PLAYER_SPEED_EATING = PCT(79);
export const PLAYER_SPEED_FRIGHT = PCT(90);
export const GHOST_SPEED = PCT(75);
export const GHOST_SPEED_FRIGHT = PCT(50);
export const GHOST_SPEED_TUNNEL = PCT(40);
export const GHOST_SPEED_EYES = PCT(160);
export const ELROY_DOTS_1 = 20;
export const ELROY_DOTS_2 = 10;
export const ELROY_SPEED_1 = PCT(80);
export const ELROY_SPEED_2 = PCT(85);

/** Player may start a turn this many px before the tile centre (R4). */
export const CORNERING_WINDOW_PX = 4;
const HALF_TILE = 8;
const TILE = 16;

/** Level-1 mode schedule in ms; the last chase runs forever (R7). */
export const MODE_SCHEDULE_MS: readonly number[] = [
  7_000, 20_000, 7_000, 20_000, 5_000, 20_000, 5_000, Number.POSITIVE_INFINITY,
];
export const FRIGHT_MS = 6_000;
export const FRIGHT_FLASHES = 5;
export const FRIGHT_SCORES = [200, 400, 800, 1600] as const;
const HOUSE_IDLE_RELEASE_MS = 4_000;
const HOUSE_DOT_COUNTERS: Readonly<Record<Exclude<BugKind, 'direct'>, number>> = Object.freeze({
  ambush: 0,
  flank: 30,
  shy: 60,
});
export const RESPAWN_MS = 1_500;
const MAX_FRAME_MS = 100;

export type GamePhase = 'idle' | 'running' | 'respawn' | 'won' | 'lost';
export type GhostMode = 'scatter' | 'chase';
export type GhostState = 'house' | 'leaving' | 'active' | 'frightened' | 'eyes';

export const GAME_EVENT_PELLET = 1;
export const GAME_EVENT_ENERGIZER = 2;
export const GAME_EVENT_EAT = 4;
export const GAME_EVENT_DEATH = 8;
export const GAME_EVENT_WON = 16;
export const GAME_EVENT_LOST = 32;
export const GAME_EVENT_MODE = 64;

/**
 * xoshiro-free tiny deterministic PRNG state — splitmix64 on BigInt would be
 * slow per junction; this xorshift32 is enough for fright wander.
 */
function nextRandom(state: number): number {
  let s = state | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return s | 0;
}

export type Actor = {
  /** Pixel position of the actor's centre. */
  x: number;
  y: number;
  facing: Direction;
  /** Desired direction held until legal (R3). For ghosts it mirrors facing. */
  desired: Direction | null;
};

export type Ghost = Actor & {
  readonly kind: BugKind;
  state: GhostState;
  frightenedTimerMs: number;
  dotsEatenSinceRelease: number;
};

export type ShipItGame = {
  phase: GamePhase;
  score: number;
  lives: number;
  level: number;
  pelletsRemaining: number;
  readonly pellets: Uint8Array<ArrayBuffer>;
  readonly player: Actor;
  readonly ghosts: readonly [Ghost, Ghost, Ghost, Ghost];
  modeIndex: number;
  mode: GhostMode;
  modeTimerMs: number;
  globalFrightTimerMs: number;
  frightChain: number;
  houseIdleTimerMs: number;
  pelletsEatenTotal: number;
  respawnTimerMs: number;
  rngState: number;
  discretePending: boolean;
  events: number;
};

export type ShipItSnapshot = Readonly<{
  phase: GamePhase;
  score: number;
  lives: number;
  pelletsRemaining: number;
  initialPellets: number;
  mode: GhostMode;
  frightActive: boolean;
  frightFlashesLeft: number;
}>;

export type ShipItEvents = Readonly<{ flags: number }>;

function centerOf(index: number): { x: number; y: number } {
  return { x: indexX(index) * TILE + HALF_TILE, y: indexY(index) * TILE + HALF_TILE };
}

export function tileOf(actor: Actor): number {
  return toIndex(Math.floor(actor.x / TILE), Math.floor(actor.y / TILE));
}

function atCenter(actor: Actor): boolean {
  return (
    Math.abs((actor.x % TILE) - HALF_TILE) < 1e-6 &&
    Math.abs((actor.y % TILE) - HALF_TILE) < 1e-6
  );
}

function makeGhost(kind: BugKind): Ghost {
  const seat = centerOf(BUG_HOUSE_SEATS[kind]);
  return {
    kind,
    x: seat.x,
    y: seat.y,
    facing: kind === 'direct' ? LEFT : UP,
    desired: null,
    state: kind === 'direct' ? 'active' : 'house',
    frightenedTimerMs: 0,
    dotsEatenSinceRelease: 0,
  };
}

export function createShipItGame(): ShipItGame {
  return {
    phase: 'idle',
    score: 0,
    lives: 3,
    level: 1,
    pelletsRemaining: INITIAL_PELLET_COUNT,
    pellets: createPellets(),
    player: { ...centerOf(PLAYER_SPAWN), facing: LEFT, desired: null },
    ghosts: [makeGhost('direct'), makeGhost('ambush'), makeGhost('flank'), makeGhost('shy')],
    modeIndex: 0,
    mode: 'scatter',
    modeTimerMs: MODE_SCHEDULE_MS[0]!,
    globalFrightTimerMs: 0,
    frightChain: 0,
    houseIdleTimerMs: 0,
    pelletsEatenTotal: 0,
    respawnTimerMs: 0,
    rngState: 0x9e3779b9,
    discretePending: false,
    events: 0,
  };
}

export function startGame(game: ShipItGame): boolean {
  if (game.phase !== 'idle') return false;
  game.phase = 'running';
  game.events |= GAME_EVENT_MODE;
  return true;
}

export function restartGame(game: ShipItGame): void {
  const fresh = createShipItGame();
  fresh.phase = 'running';
  fresh.events = game.events;
  Object.assign(game, fresh);
}

/**
 * R3: input sets the DESIRED direction. It never moves anything by itself —
 * the actor turns when the direction becomes legal, holds still otherwise.
 */
export function queueDirection(game: ShipItGame, direction: Direction): boolean {
  if (game.phase !== 'running') return false;
  game.player.desired = direction;
  game.discretePending = true;
  return true;
}

export function snapshotGame(game: ShipItGame): ShipItSnapshot {
  const flashesLeft =
    game.globalFrightTimerMs > 0
      ? Math.ceil((game.globalFrightTimerMs / FRIGHT_MS) * FRIGHT_FLASHES)
      : 0;
  return {
    phase: game.phase,
    score: game.score,
    lives: game.lives,
    pelletsRemaining: game.pelletsRemaining,
    initialPellets: INITIAL_PELLET_COUNT,
    mode: game.mode,
    frightActive: game.globalFrightTimerMs > 0,
    frightFlashesLeft: flashesLeft,
  };
}

export function drainGameEvents(game: ShipItGame): ShipItEvents {
  const flags = game.events;
  game.events = 0;
  return { flags };
}

function canGo(tile: number, direction: Direction, allowDoor: boolean): boolean {
  const next = step(tile, direction);
  if (next < 0) return false;
  if (isHouseTile(next)) return allowDoor;
  return isWalkable(next);
}

/** Legal exits from a tile, excluding house doors unless allowed through. */
function exitsFrom(
  game: ShipItGame,
  ghost: Ghost,
  tile: number,
  allowReverse: boolean,
): Exit[] {
  const exits: Exit[] = [];
  for (const direction of [UP, LEFT, DOWN, RIGHT]) {
    if (!canGo(tile, direction, ghost.state === 'eyes')) continue;
    // Red zones forbid choosing upward (R12); eyes are exempt on the way home.
    if (direction === UP && ghost.state !== 'eyes' && inRedZone(tile)) continue;
    if (!allowReverse && direction === opposite(ghost.facing)) continue;
    const next = step(tile, direction)!;
    exits.push({ direction, next });
  }
  void game;
  return exits;
}

function chaseTargetFor(game: ShipItGame, ghost: Ghost): number {
  const playerTile = tileOf(game.player);
  switch (ghost.kind) {
    case 'direct':
      return playerTile;
    case 'ambush':
      return ambushTile(playerTile, game.player.facing);
    case 'flank':
      return flankTile(playerTile, game.player.facing, tileOf(game.ghosts[0]));
    case 'shy':
      return shyTile(playerTile, tileOf(ghost), SCATTER_CORNERS.shy);
  }
}

export function targetFor(game: ShipItGame, ghost: Ghost): number {
  if (ghost.state === 'eyes') return BUG_HOUSE_SEATS.direct;
  if (ghost.state === 'frightened') return -1;
  if (ghost.kind === 'direct' && elroyLevel(game) > 0) return chaseTargetFor(game, ghost);
  return game.mode === 'scatter' && !(ghost.kind === 'direct' && elroyLevel(game) > 0)
    ? SCATTER_CORNERS[ghost.kind]
    : chaseTargetFor(game, ghost);
}

function wanderExit(game: ShipItGame, ghost: Ghost, tile: number, allowReverse: boolean): Exit | null {
  const exits = exitsFrom(game, ghost, tile, allowReverse);
  if (exits.length === 0) return null;
  game.rngState = nextRandom(game.rngState ^ (tile + 1));
  const pick = Math.abs(game.rngState) % exits.length;
  return exits[pick]!;
}

function decideGhost(game: ShipItGame, ghost: Ghost): Direction | null {
  const tile = tileOf(ghost);
  const atIntersection = atCenter(ghost);
  if (!atIntersection) return null;

  if (ghost.state === 'eyes') {
    // Inside sight of the door: dive through it.
    if (isHouseTile(step(tile, DOWN)!)) {
      return canGo(tile, DOWN, true) ? DOWN : null;
    }
  }

  if (ghost.state === 'frightened') {
    const wander = wanderExit(game, ghost, tile, false);
    if (wander) return wander.direction;
    return null;
  }

  const target = targetFor(game, ghost);
  const choice = chooseExit(exitsFrom(game, ghost, tile, false), ghost.facing, target, false);
  return choice?.direction ?? null;
}

export function elroyLevel(game: ShipItGame): number {
  if (game.pelletsRemaining <= ELROY_DOTS_2) return 2;
  if (game.pelletsRemaining <= ELROY_DOTS_1) return 1;
  return 0;
}

function ghostSpeedPx(game: ShipItGame, ghost: Ghost): number {
  if (ghost.state === 'eyes') return GHOST_SPEED_EYES;
  if (inTunnel(tileOf(ghost))) return GHOST_SPEED_TUNNEL;
  if (ghost.state === 'frightened') return GHOST_SPEED_FRIGHT;
  if (ghost.kind === 'direct') {
    const elroy = elroyLevel(game);
    if (elroy === 2) return ELROY_SPEED_2;
    if (elroy === 1) return ELROY_SPEED_1;
  }
  return GHOST_SPEED;
}

function wrapTunnel(actor: Actor): void {
  if (Math.floor(actor.y / TILE) !== TUNNEL_Y) return;
  // Wrap the moment the centre crosses the seam: tileOf() must never see a
  // negative or over-wide column, or wall lookups desync from the maze.
  if (actor.x < 0) actor.x += BOARD_WIDTH * TILE;
  else if (actor.x >= BOARD_WIDTH * TILE) actor.x -= BOARD_WIDTH * TILE;
}

/** Advance one actor along its facing by `distance` px, honouring walls. */
function advance(game: ShipItGame, actor: Actor, distance: number, allowDoor: boolean): void {
  let remaining = distance;
  while (remaining > 1e-6) {
    const tile = tileOf(actor);
    // Distance to the next centre along the current axis.
    const alongX = actor.facing === LEFT || actor.facing === RIGHT;
    const positionAlong = alongX ? actor.x : actor.y;
    const sign = actor.facing === RIGHT || actor.facing === DOWN ? 1 : -1;
    const offsetInTile = ((positionAlong % TILE) + TILE) % TILE;
    const distanceToCentre =
      sign > 0 ? (HALF_TILE - offsetInTile + TILE) % TILE || TILE : (offsetInTile - HALF_TILE + TILE) % TILE || TILE;

    const stepToCentre = Math.min(remaining, distanceToCentre);
    if (alongX) actor.x += sign * stepToCentre;
    else actor.y += sign * stepToCentre;
    remaining -= stepToCentre;
    wrapTunnel(actor);

    if (remaining <= 1e-6) break;

    // At a centre (or crossing it): re-evaluate what happens next.
    if (atCenter(actor)) {
      const tileNow = tileOf(actor);
      const desired = actor.desired;
      const turnAllowed = allowDoor || !isHouseTile(tileNow);
      if (
        turnAllowed &&
        desired !== null &&
        desired !== actor.facing &&
        canGo(tileNow, desired, !turnAllowed)
      ) {
        actor.facing = desired;
        continue;
      }
      if (canGo(tileNow, actor.facing, !turnAllowed)) continue;
      // Blocked: stop and hold (R3). No bounce, no auto-reverse.
      remaining = 0;
      break;
    }
  }
}

function releaseGhosts(game: ShipItGame, deltaMs: number): void {
  const order: Array<Exclude<BugKind, 'direct'>> = ['ambush', 'flank', 'shy'];
  let releasedThisFrame = false;
  for (const kind of order) {
    const ghost = game.ghosts.find((candidate) => candidate.kind === kind)!;
    if (ghost.state !== 'house') continue;
    const counterDue = ghost.dotsEatenSinceRelease >= HOUSE_DOT_COUNTERS[kind];
    const idleDue = game.houseIdleTimerMs >= HOUSE_IDLE_RELEASE_MS;
    if (counterDue || idleDue || releasedThisFrame === false) {
      // One release per frame keeps exit order stable.
      ghost.state = 'leaving';
      releasedThisFrame = true;
    }
  }
  void deltaMs;
}

function updateGhost(game: ShipItGame, ghost: Ghost, deltaMs: number): void {
  if (ghost.state === 'house') return;

  if (ghost.state === 'leaving') {
    const door = centerOf(HOUSE_DOOR_INDEX);
    const above = centerOf(DIRECT_SPAWN);
    const targetY = above.y;
    if (ghost.y > door.y) {
      ghost.y = Math.max(door.y, ghost.y - GHOST_SPEED * (deltaMs / 1000));
    } else {
      ghost.x += Math.sign(door.x - ghost.x) * Math.min(Math.abs(door.x - ghost.x), GHOST_SPEED * (deltaMs / 1000));
      if (Math.abs(ghost.x - door.x) < 0.5) {
        ghost.x = door.x;
        if (ghost.y <= targetY + 0.5) {
          ghost.y = targetY;
          ghost.state = 'active';
          ghost.facing = LEFT;
        } else {
          ghost.y -= GHOST_SPEED * (deltaMs / 1000);
        }
      }
    }
    return;
  }

  if (game.globalFrightTimerMs > 0 && ghost.state === 'active') {
    ghost.state = 'frightened';
    ghost.frightenedTimerMs = game.globalFrightTimerMs;
  }
  if (ghost.state === 'frightened') {
    ghost.frightenedTimerMs -= deltaMs;
    if (ghost.frightenedTimerMs <= 0) {
      ghost.state = 'active';
      ghost.frightenedTimerMs = 0;
    }
  }

  // Eyes navigate home through the door; everything else respects it.
  const decisionAtCentresOnly = decideGhost(game, ghost);
  advance(game, ghost, ghostSpeedPx(game, ghost) * (deltaMs / 1000), ghost.state === 'eyes');
  void decisionAtCentresOnly;
}

function collide(game: ShipItGame): void {
  for (const ghost of game.ghosts) {
    if (ghost.state === 'eyes' || ghost.state === 'house' || ghost.state === 'leaving') continue;
    const dx = ghost.x - game.player.x;
    const dy = ghost.y - game.player.y;
    if (dx * dx + dy * dy >= 36) continue;

    if (ghost.state === 'frightened') {
      const points = FRIGHT_SCORES[Math.min(game.frightChain, FRIGHT_SCORES.length - 1)]!;
      game.score += points;
      game.frightChain++;
      game.events |= GAME_EVENT_EAT;
      ghost.state = 'eyes';
      ghost.frightenedTimerMs = 0;
    } else {
      game.lives--;
      game.events |= GAME_EVENT_DEATH;
      if (game.lives <= 0) {
        game.phase = 'lost';
        game.events |= GAME_EVENT_LOST;
      } else {
        game.phase = 'respawn';
        game.respawnTimerMs = RESPAWN_MS;
      }
      return;
    }
  }
}

function resetActorsAfterDeath(game: ShipItGame): void {
  const player = centerOf(PLAYER_SPAWN);
  Object.assign(game.player, player, { facing: LEFT, desired: null });
  for (const ghost of game.ghosts) {
    const seat = centerOf(BUG_HOUSE_SEATS[ghost.kind]);
    Object.assign(ghost, seat, {
      facing: ghost.kind === 'direct' ? LEFT : UP,
      desired: null,
      state: ghost.kind === 'direct' ? 'active' : 'house',
      frightenedTimerMs: 0,
    });
  }
  game.modeIndex = 0;
  game.mode = 'scatter';
  game.modeTimerMs = MODE_SCHEDULE_MS[0]!;
  game.globalFrightTimerMs = 0;
  game.frightChain = 0;
  game.houseIdleTimerMs = 0;
}

function updateModes(game: ShipItGame, deltaMs: number): void {
  if (game.globalFrightTimerMs > 0) return; // Timer pauses while frightened (R7).
  game.modeTimerMs -= deltaMs;
  if (game.modeTimerMs > 0) return;
  game.modeIndex = Math.min(game.modeIndex + 1, MODE_SCHEDULE_MS.length - 1);
  game.mode = game.modeIndex % 2 === 0 ? 'scatter' : 'chase';
  game.modeTimerMs = MODE_SCHEDULE_MS[game.modeIndex]!;
  game.events |= GAME_EVENT_MODE;
  // R8: reverse every ghost immediately on a mode change.
  for (const ghost of game.ghosts) {
    if (ghost.state !== 'active' && ghost.state !== 'frightened') continue;
    ghost.facing = opposite(ghost.facing);
    if (ghost.state === 'active') ghost.state = 'frightened', ghost.frightenedTimerMs = 0;
  }
}

function eatAt(game: ShipItGame, tile: number): void {
  const pellet = game.pellets[tile];
  if (!pellet) return;
  game.pellets[tile] = 0;
  game.pelletsRemaining--;
  game.pelletsEatenTotal++;
  game.houseIdleTimerMs = 0;
  for (const ghost of game.ghosts) ghost.dotsEatenSinceRelease++;
  if (pellet === 2) {
    game.events |= GAME_EVENT_ENERGIZER;
    game.globalFrightTimerMs = FRIGHT_MS;
    game.frightChain = 0;
    for (const ghost of game.ghosts) {
      if (ghost.state === 'house' || ghost.state === 'leaving') continue;
      ghost.facing = opposite(ghost.facing);
      ghost.state = 'frightened';
      ghost.frightenedTimerMs = FRIGHT_MS;
    }
  } else {
    game.events |= GAME_EVENT_PELLET;
  }
  game.score += pellet === 2 ? 50 : 10;
  if (game.pelletsRemaining <= 0) {
    game.phase = 'won';
    game.events |= GAME_EVENT_WON;
  }
}

function stepLive(game: ShipItGame, deltaMs: number): boolean {
  if (game.phase !== 'running' && game.phase !== 'respawn') return false;

  if (game.phase === 'respawn') {
    game.respawnTimerMs -= deltaMs;
    if (game.respawnTimerMs <= 0) {
      resetActorsAfterDeath(game);
      game.phase = 'running';
    }
    return true;
  }

  updateModes(game, deltaMs);
  if (game.globalFrightTimerMs > 0) {
    game.globalFrightTimerMs -= deltaMs;
    if (game.globalFrightTimerMs <= 0) {
      game.globalFrightTimerMs = 0;
      for (const ghost of game.ghosts) {
        if (ghost.state === 'frightened') ghost.state = 'active';
      }
    }
  }

  game.houseIdleTimerMs += deltaMs;
  releaseGhosts(game, deltaMs);

  // Player: desired-direction movement with cornering window (R3/R4).
  const eating = game.pellets[tileOf(game.player)] !== 0;
  const speed = (game.globalFrightTimerMs > 0 ? PLAYER_SPEED_FRIGHT : eating ? PLAYER_SPEED_EATING : PLAYER_SPEED) * (deltaMs / 1000);
  advancePlayer(game, speed);

  for (const ghost of game.ghosts) updateGhost(game, ghost, deltaMs);

  eatAt(game, tileOf(game.player));
  collide(game);
  return true;
}

/**
 * Player movement differs from ghosts: the turn may START within the ~4px
 * cornering window before the centre, cutting the corner (R4).
 */
function advancePlayer(game: ShipItGame, distance: number): void {
  const player = game.player;
  let remaining = distance;
  while (remaining > 1e-6) {
    const tile = tileOf(player);
    const desired = player.desired;

    // Standing exactly on a centre (e.g. we stopped here last frame): run the
    // centre decision before moving again, or a wall one tile ahead would
    // never be seen.
    if (atCenter(player)) {
      if (desired !== null && desired !== player.facing && canGo(tile, desired, false)) {
        player.facing = desired;
        player.desired = null;
      } else if (!canGo(tile, player.facing, false)) {
        break; // corner-stuck: hold position and keep the desired direction
      }
    }

    // Reversal is instant whenever the path behind is open — but ONLY when the
    // player asked for it; the engine never invents one (R3).
    if (desired !== null && desired === opposite(player.facing)) {
      if (canGo(tile, desired, false)) {
        player.facing = desired;
        player.desired = null;
      }
    }

    const alongX = player.facing === LEFT || player.facing === RIGHT;
    const positionAlong = alongX ? player.x : player.y;
    const sign = player.facing === RIGHT || player.facing === DOWN ? 1 : -1;
    const offsetInTile = ((positionAlong % TILE) + TILE) % TILE;
    const distanceToCentre =
      sign > 0
        ? (HALF_TILE - offsetInTile + TILE) % TILE || TILE
        : (offsetInTile - HALF_TILE + TILE) % TILE || TILE;

    // Cornering: try the perpendicular desired turn inside the window.
    if (
      desired !== null &&
      desired !== player.facing &&
      desired !== opposite(player.facing) &&
      distanceToCentre > 0 &&
      distanceToCentre <= CORNERING_WINDOW_PX
    ) {
      const crossOpen = canGo(neighbourTileTowards(tile, desired), desired, false)
        ? canGo(tileOf(player), desired, false) ||
          canGoNeighbourPerpendicular(player, tile, desired)
        : false;
      if (crossOpen) {
        // Snap onto the new axis at the lane centre, preserving progress.
        applyCornerTurn(player, desired);
        player.desired = null;
        continue;
      }
    }

    const stepPx = Math.min(remaining, distanceToCentre);
    if (alongX) player.x += sign * stepPx;
    else player.y += sign * stepPx;
    remaining -= stepPx;
    wrapTunnel(player);
    if (remaining <= 1e-6) break;

    if (atCenter(player)) {
      const tileNow = tileOf(player);
      if (desired !== null && desired !== player.facing && canGo(tileNow, desired, false)) {
        player.facing = desired;
        player.desired = null;
        continue;
      }
      if (canGo(tileNow, player.facing, false)) continue;
      // Corner-stuck: stop and hold the desired direction. Never bounce.
      remaining = 0;
      break;
    }
  }
}

function neighbourTileTowards(tile: number, direction: Direction): number {
  return step(tile, direction);
}

function canGoNeighbourPerpendicular(player: Actor, tile: number, desired: Direction): boolean {
  void player;
  return isWalkable(step(tile, desired)!);
}

function applyCornerTurn(player: Actor, desired: Direction): void {
  const tile = tileOf(player);
  const centre = centerOf(tile);
  // Keep travel-axis progress, snap the cross axis to the lane centre.
  if (desired === UP || desired === DOWN) {
    player.x = centre.x;
  } else {
    player.y = centre.y;
  }
  player.facing = desired;
}

export function stepGame(game: ShipItGame, deltaMsRaw: number): boolean {
  if (game.phase !== 'running' && game.phase !== 'respawn') return false;
  let changed = false;
  let left = Math.max(0, deltaMsRaw);
  while (left > 1e-6) {
    const slice = Math.min(left, MAX_FRAME_MS);
    changed = stepLive(game, slice) || changed;
    if (game.phase === 'won' || game.phase === 'lost') break;
    left -= slice;
  }
  return changed;
}

/**
 * Reduced motion (R23): one fixed simulation step per legal input, no clock.
 * A call without any queued input does nothing.
 */
export function stepDiscrete(game: ShipItGame): boolean {
  if (game.phase !== 'running') return false;
  if (!game.discretePending) return false;
  game.discretePending = false;
  return stepGame(game, 120);
}
