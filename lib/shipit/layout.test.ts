import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_ROWS,
  BOARD_SIZE,
  BOARD_WIDTH,
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
  isHouseTile,
  isWalkable,
  neighbourIndex,
} from './layout';

const CARDINALS = [
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 0],
] as const;

function distancesFrom(start: number): Int16Array<ArrayBuffer> {
  const distances = new Int16Array(BOARD_SIZE);
  distances.fill(-1);
  const queue = new Int16Array(BOARD_SIZE);
  distances[start] = 0;
  queue[0] = start;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const current = queue[head++]!;
    for (const [dx, dy] of CARDINALS) {
      const next = neighbourIndex(current, dx, dy);
      if (next >= 0 && distances[next] === -1) {
        distances[next] = distances[current]! + 1;
        queue[tail++] = next;
      }
    }
  }
  return distances;
}

/** FNV-1a over the wall mask, matching the pin in this test. */
export function wallMaskHash(): number {
  let fnv = 0x811c9dc5;
  for (let index = 0; index < BOARD_SIZE; index++) {
    fnv ^= isWalkable(index) ? 0 : 1;
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
  }
  return fnv >>> 0;
}

describe('shipit layout', () => {
  it('is a fixed 28×31 board', () => {
    expect(BOARD_WIDTH).toBe(28);
    expect(BOARD_HEIGHT).toBe(31);
    expect(BOARD_SIZE).toBe(BOARD_WIDTH * BOARD_HEIGHT);
    for (const row of BOARD_ROWS) expect(row).toHaveLength(BOARD_WIDTH);
  });

  it('carries the authored wall mask, not any published dump', () => {
    // Pin of our own hand-drawn walls. If an original maze is ever pasted in,
    // this hash moves and the test fails before anything ships.
    expect(wallMaskHash()).toBe(0x29ed49b9);
  });

  it('has exactly four energizers in four distinct quadrants', () => {
    const pellets = createPellets();
    const energizers: Array<[number, number]> = [];
    for (let index = 0; index < BOARD_SIZE; index++) {
      if (pellets[index] === 2) energizers.push([indexX(index), indexY(index)]);
    }
    expect(energizers).toHaveLength(4);
    const quadrants: Record<string, number> = {};
    for (const [x, y] of energizers) {
      const key = `${x < BOARD_WIDTH / 2 ? 'L' : 'R'}${y < BOARD_HEIGHT / 2 ? 'T' : 'B'}`;
      quadrants[key] = (quadrants[key] ?? 0) + 1;
    }
    expect(Object.keys(quadrants)).toHaveLength(4);
  });

  it('keeps roughly 240 pellets plus four energizers', () => {
    expect(INITIAL_PELLET_COUNT).toBeGreaterThanOrEqual(220);
    expect(INITIAL_PELLET_COUNT).toBeLessThanOrEqual(260);
    expect(INITIAL_PELLET_COUNT).toBe(247);
  });

  it('opens exactly two tunnel mouths on one mid-height row', () => {
    expect(TUNNEL_Y).toBe(14);
    const mouths: number[] = [];
    for (const x of [0, BOARD_WIDTH - 1]) {
      if (isWalkable(x + TUNNEL_Y * BOARD_WIDTH)) mouths.push(x);
    }
    expect(mouths).toEqual([0, BOARD_WIDTH - 1]);
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (y === TUNNEL_Y) continue;
      expect(isWalkable(y * BOARD_WIDTH)).toBe(false);
      expect(isWalkable(y * BOARD_WIDTH + BOARD_WIDTH - 1)).toBe(false);
    }
  });

  it('wraps movement across the tunnel and nowhere else', () => {
    const leftMouth = TUNNEL_Y * BOARD_WIDTH;
    const rightMouth = TUNNEL_Y * BOARD_WIDTH + BOARD_WIDTH - 1;
    expect(neighbourIndex(leftMouth, -1, 0)).toBe(rightMouth);
    expect(neighbourIndex(rightMouth, 1, 0)).toBe(leftMouth);
    expect(neighbourIndex(0, 0, -1)).toBe(-1);
  });

  it('holds a central house with a door and four interior seats', () => {
    expect(isHouseTile(HOUSE_DOOR_INDEX)).toBe(true);
    for (const seat of Object.values(BUG_HOUSE_SEATS)) {
      if (seat === DIRECT_SPAWN) continue;
      expect(isHouseTile(seat)).toBe(true);
    }
  });

  it('connects every walkable tile to the player spawn', () => {
    const distances = distancesFrom(PLAYER_SPAWN);
    for (let index = 0; index < BOARD_SIZE; index++) {
      if (!isWalkable(index)) continue;
      expect(distances[index]).toBeGreaterThanOrEqual(0);
    }
  });

  it('reaches every pellet and energizer from the player spawn', () => {
    const pellets = createPellets();
    const distances = distancesFrom(PLAYER_SPAWN);
    for (let index = 0; index < BOARD_SIZE; index++) {
      if (pellets[index]) expect(distances[index]).toBeGreaterThan(0);
    }
  });

  it('spawns actors on legal tiles with corners walkable', () => {
    expect(indexY(PLAYER_SPAWN)).toBe(17);
    expect(indexY(DIRECT_SPAWN)).toBe(11);
    for (const corner of Object.values(SCATTER_CORNERS)) {
      expect(isWalkable(corner)).toBe(true);
    }
  });
});
