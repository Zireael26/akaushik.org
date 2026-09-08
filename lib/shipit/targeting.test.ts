import { describe, expect, it } from 'vitest';
import {
  DOWN,
  DIRECTIONS,
  LEFT,
  RIGHT,
  UP,
  ambushTile,
  chooseExit,
  flankTile,
  opposite,
  shyTile,
  step,
  type Exit,
} from './targeting';
import {
  BOARD_WIDTH,
  SCATTER_CORNERS,
  TUNNEL_Y,
  indexX,
  indexY,
  toIndex,
} from './layout';

function tile(x: number, y: number): number {
  return toIndex(x, y);
}

/** Exits of `from`, in tie-break order, over the given open next tiles. */
function exitsFrom(from: number, directions: readonly (0 | 1 | 2 | 3)[]): Exit[] {
  const exits: Exit[] = [];
  for (const direction of directions) {
    const next = step(from, direction);
    if (next >= 0) exits.push({ direction, next });
  }
  return exits;
}

describe('shipit targeting — ambush', () => {
  it('targets four tiles ahead', () => {
    const player = tile(10, 10);
    expect(ambushTile(player, RIGHT)).toBe(tile(14, 10));
    expect(ambushTile(player, LEFT)).toBe(tile(6, 10));
    expect(ambushTile(player, DOWN)).toBe(tile(10, 14));
  });

  it('applies the up-direction overflow: four up AND four left', () => {
    const player = tile(20, 15);
    expect(ambushTile(player, UP)).toBe(tile(16, 11));
    // No such overflow for any other facing.
    expect(ambushTile(player, DOWN)).toEqual(tile(20, 19));
    expect(ambushTile(player, LEFT)).toEqual(tile(16, 15));
    expect(ambushTile(player, RIGHT)).toEqual(tile(24, 15));
  });

  it('clamps overflow targets to the board instead of escaping it', () => {
    const player = tile(2, 3);
    const target = ambushTile(player, UP);
    expect(indexY(target)).toBeGreaterThanOrEqual(0);
    expect(indexX(target)).toBeGreaterThanOrEqual(0);
  });
});

describe('shipit targeting — flank', () => {
  it('doubles the vector from Direct through the two-ahead pivot', () => {
    const player = tile(14, 17);
    const direct = tile(13, 8);
    // Pivot: (16,17). Vector direct->pivot = (3,9). Doubled: (19,26).
    expect(flankTile(player, RIGHT, direct)).toBe(tile(19, 26));
  });

  it('mirrors Direct across the pivot when Direct is two left of it', () => {
    const player = tile(10, 5);
    const direct = tile(8, 5);
    // Pivot: (12,5); doubled vector lands at (16,5).
    expect(flankTile(player, RIGHT, direct)).toBe(tile(16, 5));
  });

  it('clamps to the board when the doubled vector leaves it', () => {
    const player = tile(4, 4);
    const target = flankTile(player, LEFT, tile(27, 30));
    expect(indexX(target)).toBeGreaterThanOrEqual(0);
    expect(indexY(target)).toBeLessThan(31);
  });
});

describe('shipit targeting — shy', () => {
  const corner = SCATTER_CORNERS.shy;

  it('chases beyond eight tiles', () => {
    const shy = tile(3, 25);
    const player = tile(24, 3);
    expect(shyTile(player, shy, corner)).toBe(player);
  });

  it('flees to its corner within eight tiles', () => {
    const shy = tile(6, 24);
    const player = tile(10, 22);
    expect(shyTile(player, shy, corner)).toBe(corner);
  });

  it('holds the chase at exactly eight tiles and flees one step closer', () => {
    // Distance exactly 8: dx=8, dy=0 → squared 64 → NOT greater than 64.
    const shy = tile(5, 5);
    const player = tile(13, 5);
    expect(shyTile(player, shy, corner)).toBe(corner);
    // Distance just past the boundary: squared 65 → chase.
    const far = tile(14, 6);
    expect(shyTile(far, shy, corner)).toBe(far);
  });
});

describe('shipit targeting — exit choice', () => {
  it('never reverses while a forward exit exists', () => {
    // Corridor junction at (7,8): up is open, right is open; arrival was RIGHT.
    const here = tile(7, 8);
    const options = exitsFrom(here, [UP, RIGHT, LEFT]);
    const choice = chooseExit(options, RIGHT, tile(1, 1));
    expect(choice?.direction).not.toBe(LEFT);
  });

  it('picks the straight-line nearest exit', () => {
    const here = tile(7, 8);
    const options = exitsFrom(here, [UP, RIGHT]);
    const choice = chooseExit(options, null, tile(7, 1));
    expect(choice).toEqual({ direction: UP, next: tile(7, 7) });
    const other = chooseExit(options, null, tile(20, 8));
    expect(other).toEqual({ direction: RIGHT, next: tile(8, 8) });
  });

  it('breaks ties up before left before down', () => {
    // Equidistant exits, deliberately NOT in tie-break order: the chooser's
    // scan order must decide, not array order.
    const target = tile(10, 10);
    const synthetic: Exit[] = [
      { direction: DOWN, next: tile(10, 12) },
      { direction: RIGHT, next: tile(13, 10) },
      { direction: UP, next: tile(10, 8) },
      { direction: LEFT, next: tile(7, 11) },
    ];
    expect(chooseExit(synthetic, null, target)?.direction).toBe(UP);
    // Without UP, DOWN (distance 2) is the nearest; LEFT/RIGHT are farther.
    const withoutUp = synthetic.filter((exit) => exit.direction !== UP);
    expect(chooseExit(withoutUp, null, target)?.direction).toBe(DOWN);
    // A pure tie between UP and DOWN resolves to UP wherever they sit in the array.
    const tiedPair: Exit[] = [
      { direction: DOWN, next: tile(10, 12) },
      { direction: UP, next: tile(10, 8) },
    ];
    expect(chooseExit(tiedPair, null, target)?.direction).toBe(UP);

  });

  it('takes the reversal only at a dead end or on an explicit allowReverse', () => {
    const here = tile(7, 8);
    const onlyBack = exitsFrom(here, [RIGHT]);
    const choice = chooseExit(onlyBack, LEFT, tile(1, 1));
    expect(choice?.direction).toBe(RIGHT);

    const withForward = exitsFrom(here, [UP, RIGHT]);
    expect(chooseExit(withForward, LEFT, tile(1, 1))?.direction).toBe(UP);
    const forced = chooseExit(exitsFrom(here, [RIGHT]), LEFT, tile(1, 1), true);
    expect(forced?.direction).toBe(RIGHT);
  });

  it('resolves tunnel wrap for exits off either edge', () => {
    const leftMouth = tile(0, TUNNEL_Y);
    const wrapExit = step(leftMouth, LEFT);
    expect(wrapExit).toBe(tile(BOARD_WIDTH - 1, TUNNEL_Y));
    const rightMouth = tile(BOARD_WIDTH - 1, TUNNEL_Y);
    expect(step(rightMouth, RIGHT)).toBe(leftMouth);
    // Off-board outside the tunnel row never wraps.
    expect(step(tile(0, 1), LEFT)).toBe(-1);
    expect(step(tile(BOARD_WIDTH - 1, 30), RIGHT)).toBe(-1);
  });
});

describe('shipit targeting — helpers', () => {
  it('orders directions as up, left, down, right', () => {
    expect(DIRECTIONS).toEqual([UP, LEFT, DOWN, RIGHT]);
  });

  it('maps each direction to its opposite', () => {
    expect(opposite(UP)).toBe(DOWN);
    expect(opposite(DOWN)).toBe(UP);
    expect(opposite(LEFT)).toBe(RIGHT);
    expect(opposite(RIGHT)).toBe(LEFT);
  });
});
