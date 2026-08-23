import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_ROWS,
  BOARD_SIZE,
  BOARD_WIDTH,
  CUTLINE_SPAWN,
  DIRECT_SPAWN,
  DRIFT_SPAWN,
  INITIAL_READING_COUNT,
  PLAYER_SPAWN,
  PURSUER_SPAWNS,
  createReadings,
  indexX,
  indexY,
  isWalkable,
  neighbourIndex,
} from './layout';

const CARDINALS = [
  [0, -1],
  [0, 1],
  [-1, 0],
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
    const cell = queue[head++]!;
    for (const [dx, dy] of CARDINALS) {
      const next = neighbourIndex(cell, dx, dy);
      if (next < 0 || distances[next]! >= 0) continue;
      distances[next] = distances[cell]! + 1;
      queue[tail++] = next;
    }
  }
  return distances;
}

describe('arcade layout', () => {
  it('is a fixed rectangular board with one of each authored spawn', () => {
    expect(BOARD_WIDTH).toBe(25);
    expect(BOARD_HEIGHT).toBe(17);
    expect(BOARD_ROWS.every((row) => row.length === BOARD_WIDTH)).toBe(true);

    const source = BOARD_ROWS.join('');
    for (const marker of ['P', 'D', 'C', 'W']) {
      expect(source.split(marker)).toHaveLength(2);
    }
    expect(new Set([PLAYER_SPAWN, ...PURSUER_SPAWNS]).size).toBe(4);
  });

  it('keeps a solid border with no wrap tunnel', () => {
    expect(BOARD_ROWS[0]).toBe('#'.repeat(BOARD_WIDTH));
    expect(BOARD_ROWS[BOARD_HEIGHT - 1]).toBe('#'.repeat(BOARD_WIDTH));
    for (const row of BOARD_ROWS) {
      expect(row[0]).toBe('#');
      expect(row[BOARD_WIDTH - 1]).toBe('#');
    }
  });

  it('is neither horizontally nor vertically mirrored', () => {
    const horizontalMirror = BOARD_ROWS.map((row) => [...row].reverse().join(''));
    const verticalMirror = [...BOARD_ROWS].reverse();
    expect(horizontalMirror).not.toEqual(BOARD_ROWS);
    expect(verticalMirror).not.toEqual(BOARD_ROWS);
  });

  it('has no low-exit room in the central field', () => {
    const middleLeft = Math.floor(BOARD_WIDTH / 3);
    const middleRight = Math.ceil((BOARD_WIDTH * 2) / 3);
    const middleTop = Math.floor(BOARD_HEIGHT / 3);
    const middleBottom = Math.ceil((BOARD_HEIGHT * 2) / 3);
    const remaining = new Set<number>();
    for (let y = middleTop; y < middleBottom; y++) {
      for (let x = middleLeft; x < middleRight; x++) {
        const index = y * BOARD_WIDTH + x;
        if (isWalkable(index)) remaining.add(index);
      }
    }

    while (remaining.size) {
      const first = remaining.values().next().value!;
      const component = [first];
      remaining.delete(first);
      let exits = 0;
      for (let head = 0; head < component.length; head++) {
        const cell = component[head]!;
        for (const [dx, dy] of CARDINALS) {
          const next = neighbourIndex(cell, dx, dy);
          if (next < 0) continue;
          const x = indexX(next);
          const y = indexY(next);
          const inside = x >= middleLeft && x < middleRight && y >= middleTop && y < middleBottom;
          if (!inside) {
            exits++;
          } else if (remaining.delete(next)) {
            component.push(next);
          }
        }
      }
      expect(exits, `central component at ${first} has a single gate`).toBeGreaterThanOrEqual(2);
    }

    for (const spawn of PURSUER_SPAWNS) {
      const inCentralColumns = indexX(spawn) >= middleLeft && indexX(spawn) < middleRight;
      const inCentralRows = indexY(spawn) >= middleTop && indexY(spawn) < middleBottom;
      expect(inCentralColumns && inCentralRows).toBe(false);
    }
  });

  it('connects every path, reading and spawn to the player', () => {
    const distances = distancesFrom(PLAYER_SPAWN);
    const readings = createReadings();
    for (let index = 0; index < BOARD_SIZE; index++) {
      if (!isWalkable(index)) continue;
      expect(distances[index], `unreachable cell ${index}`).toBeGreaterThanOrEqual(0);
      if (readings[index]) expect(distances[index]).toBeGreaterThan(0);
    }
  });

  it('keeps readings off spawns and pursuers at a safe distance', () => {
    const readings = createReadings();
    expect(readings.reduce((sum, value) => sum + value, 0)).toBe(INITIAL_READING_COUNT);
    expect(readings[PLAYER_SPAWN]).toBe(0);
    expect(readings[DIRECT_SPAWN]).toBe(0);
    expect(readings[CUTLINE_SPAWN]).toBe(0);
    expect(readings[DRIFT_SPAWN]).toBe(0);

    const distances = distancesFrom(PLAYER_SPAWN);
    for (const spawn of PURSUER_SPAWNS) expect(distances[spawn]).toBeGreaterThanOrEqual(6);
  });
});
