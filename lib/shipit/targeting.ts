/**
 * Pure targeting for the four Ship It bugs and the shared exit choice.
 *
 * No clock, no DOM, no RNG — every function here is a straight map from
 * board positions to a decision, which is what makes the personalities
 * unit-testable in isolation (spec R9–R12).
 */
import { BOARD_HEIGHT, BOARD_WIDTH, SCATTER_CORNERS, TUNNEL_Y, indexX, indexY, toIndex } from './layout';

export type Direction = 0 | 1 | 2 | 3;
// Ordered UP=0, LEFT=1, DOWN=2, RIGHT=3 so the required tie-break
// (up > left > down) is a plain ascending scan with strict improvement only.
export const UP: Direction = 0;
export const LEFT: Direction = 1;
export const DOWN: Direction = 2;
export const RIGHT: Direction = 3;

const DX = [0, -1, 0, 1] as const;
const DY = [-1, 0, 1, 0] as const;

export const DIRECTIONS: readonly Direction[] = [UP, LEFT, DOWN, RIGHT];

/** The one legal reversal; also the mode-change reverse direction. */
export function opposite(direction: Direction): Direction {
  return ((direction + 2) % 4) as Direction;
}

/**
 * The tile one step from `from` in `direction`, wrapping across the tunnel
 * row. Off-board columns outside the tunnel row resolve to -1.
 */
export function step(from: number, direction: Direction): number {
  const x = indexX(from) + DX[direction]!;
  const y = indexY(from) + DY[direction]!;
  if (y < 0 || y >= BOARD_HEIGHT) return -1;
  if (x < 0) return y === TUNNEL_Y ? toIndex(BOARD_WIDTH - 1, y) : -1;
  if (x >= BOARD_WIDTH) return y === TUNNEL_Y ? toIndex(0, y) : -1;
  return toIndex(x, y);
}

/** Squared straight-line distance — same ordering as Euclidean, no sqrt. */
function squaredDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function clampToBoard(tile: number): number {
  const x = Math.min(BOARD_WIDTH - 1, Math.max(0, indexX(tile)));
  const y = Math.min(BOARD_HEIGHT - 1, Math.max(0, indexY(tile)));
  return toIndex(x, y);
}

/**
 * Ambush: 4 tiles ahead of the player. When the player faces up, the target
 * is 4 up AND 4 left — the original's vector overflow, kept deliberately.
 */
export function ambushTile(playerTile: number, facing: Direction): number {
  const x = indexX(playerTile) + DX[facing]! * 4;
  const y = indexY(playerTile) + DY[facing]! * 4;
  return clampToBoard(toIndex(facing === UP ? x - 4 : x, y));
}

/** Flank: double the vector from Direct's tile through 2-ahead-of-player. */
export function flankTile(playerTile: number, facing: Direction, directTile: number): number {
  const pivotX = indexX(playerTile) + DX[facing]! * 2;
  const pivotY = indexY(playerTile) + DY[facing]! * 2;
  return clampToBoard(
    toIndex(pivotX * 2 - indexX(directTile), pivotY * 2 - indexY(directTile)),
  );
}

/** Shy: chase when farther than 8 tiles (Euclidean), else flee to its corner. */
export function shyTile(playerTile: number, shyCurrentTile: number, scatterCorner: number): number {
  const dx = indexX(playerTile) - indexX(shyCurrentTile);
  const dy = indexY(playerTile) - indexY(shyCurrentTile);
  return dx * dx + dy * dy > 64 ? playerTile : scatterCorner;
}

export type Exit = Readonly<{ direction: Direction; next: number }>;

/**
 * Pick the exit whose next tile is nearest `target` by straight-line distance.
 * Ties break up > left > down because DIRECTIONS is ordered that way and the
 * scan keeps strict improvements only. A reversal is never returned unless it
 * is the sole option (a dead end) or `allowReverse` is set — the mode-change
 * reversal is the one legal case.
 */
export function chooseExit(
  exits: readonly Exit[],
  facing: Direction | null,
  target: number,
  allowReverse = false,
): Exit | null {
  if (exits.length === 0) return null;
  const reversed = facing === null ? -1 : opposite(facing);
  let best: Exit | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  // DIRECTIONS is ordered up > left > down > right, so scanning candidates in
  // that canonical order with strict improvement makes equal distances resolve
  // to the earlier direction regardless of how the caller ordered `exits`.
  const ordered = [...exits].sort((a, b) => a.direction - b.direction);
  for (const exit of ordered) {
    if (!allowReverse && exit.direction === reversed) continue;
    if (exit.next < 0) continue;
    const distance = squaredDistance(indexX(exit.next), indexY(exit.next), indexX(target), indexY(target));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = exit;
    }
  }
  if (best === null && !allowReverse && reversed >= 0) {
    // Dead end holding only the reversal: take it rather than freeze.
    for (const exit of exits) if (exit.direction === reversed) return exit;
  }
  return best;
}
