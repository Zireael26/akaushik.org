/**
 * Ship It board — an authored 28×31 maze in this site's own wall language.
 *
 * The grammar is the classic maze-chase one (central ghost house, four corner
 * energizers, a mid-height warp tunnel, no-turn-up zones); the walls are ours.
 * Rows are authored by hand and compiled once at module load; row width is
 * validated here so a typo fails fast instead of drawing a broken board.
 *
 * Tile characters:
 *   `#` wall · `.` pellet · `o` energizer · space empty path
 *   `H` house door · `h` house interior · `V` authored void (outside pocket)
 *   `*` red-zone pellet (pellet + zone membership) · `P` player spawn
 *   `D` direct-bug spawn, on the row above the house door
 */
const VOID = 0;
const WALL = 1;
const PATH = 2;
const HOUSE_DOOR = 3;
const HOUSE_FLOOR = 4;

export const BOARD_ROWS = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#......              ......#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##..........##......#',
  '######.##.**....**.##.######',
  'VVVVV#.##.##....##.##.#VVVVV',
  'VVVVV#.##    D     ##.#VVVVV',
  'VVVVV#.## ###HH### ##.#VVVVV',
  'VVVVV#.## #hhhhhh# ##.#VVVVV',
  'T         #hhhhhh#         T',
  'VVVVV#.## #hhhhhh# ##.#VVVVV',
  'VVVVV#.## ######## ##.#VVVVV',
  'VVVVV#.##      P   ##.#VVVVV',
  '######.##.**....**.##.######',
  '######.##....##....##.######',
  '######.#####.##.#####.######',
  '######.##....##....##.######',
  '######.##.########.##.######',
  '#.....                .....#',
  '#.####.##.########.##.####.#',
  '#......##......... ##......#',
  '#o####.##.########.##.####o#',
  '#......              ......#',
  '#.####.##.########.##.####.#',
  '#..........................#',
  '############################',
] as const;

export const BOARD_WIDTH = BOARD_ROWS[0].length;
export const BOARD_HEIGHT = BOARD_ROWS.length;
export const BOARD_SIZE = BOARD_WIDTH * BOARD_HEIGHT;

export type BugKind = 'direct' | 'ambush' | 'flank' | 'shy';

function findMarker(marker: string): number {
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    const x = BOARD_ROWS[y]!.indexOf(marker);
    if (x >= 0) return y * BOARD_WIDTH + x;
  }
  throw new Error(`Ship It layout is missing ${marker}`);
}

export const PLAYER_SPAWN = findMarker('P');
export const HOUSE_DOOR_INDEX = findMarker('H');
export const DIRECT_SPAWN = findMarker('D');

/** Ghost-house seats: direct starts above the door, the rest inside. */
export const BUG_HOUSE_SEATS: Readonly<Record<BugKind, number>> = Object.freeze({
  direct: DIRECT_SPAWN,
  ambush: 14 * BOARD_WIDTH + 11,
  flank: 14 * BOARD_WIDTH + 16,
  shy: 15 * BOARD_WIDTH + 13,
});

/** Scatter corners sit one tile inside each quadrant of the field. */
export const SCATTER_CORNERS: Readonly<Record<BugKind, number>> = Object.freeze({
  direct: toIndex(1, 1),
  ambush: toIndex(BOARD_WIDTH - 2, 1),
  shy: toIndex(1, BOARD_HEIGHT - 2),
  flank: toIndex(BOARD_WIDTH - 2, BOARD_HEIGHT - 2),
});

const tiles = new Uint8Array(BOARD_SIZE);
const initialPellets = new Uint8Array(BOARD_SIZE);
const redZones = new Uint8Array(BOARD_SIZE);

let pelletCount = 0;
for (let y = 0; y < BOARD_HEIGHT; y++) {
  const row = BOARD_ROWS[y]!;
  if (row.length !== BOARD_WIDTH) throw new Error(`Ship It row ${y} has width ${row.length}`);

  for (let x = 0; x < BOARD_WIDTH; x++) {
    const marker = row[x]!;
    const index = toIndex(x, y);
    switch (marker) {
      case '#':
        tiles[index] = WALL;
        break;
      case 'V':
        tiles[index] = VOID;
        break;
      case 'H':
        tiles[index] = HOUSE_DOOR;
        break;
      case 'h':
        tiles[index] = HOUSE_FLOOR;
        break;
      default:
        tiles[index] = PATH;
        if (marker === '.' || marker === '*' || marker === 'o') {
          initialPellets[index] = marker === 'o' ? 2 : 1;
          pelletCount++;
        }
    }
    if (marker === '*') redZones[index] = 1;
  }
}

export const INITIAL_PELLET_COUNT = pelletCount;

export function toIndex(x: number, y: number): number {
  return y * BOARD_WIDTH + x;
}

export function indexX(index: number): number {
  return index % BOARD_WIDTH;
}

export function indexY(index: number): number {
  return Math.floor(index / BOARD_WIDTH);
}

export function isWalkable(index: number): boolean {
  const tile = index >= 0 && index < BOARD_SIZE ? tiles[index]! : VOID;
  return tile !== VOID && tile !== WALL;
}

export function isHouseTile(index: number): boolean {
  const tile = index >= 0 && index < BOARD_SIZE ? tiles[index]! : VOID;
  return tile === HOUSE_DOOR || tile === HOUSE_FLOOR;
}

export function inRedZone(index: number): boolean {
  return index >= 0 && index < BOARD_SIZE && redZones[index] === 1;
}

/** Row of the horizontal warp tunnel; actors wrap across it. */
export const TUNNEL_Y = Math.floor(findMarker('T') / BOARD_WIDTH);

export function inTunnel(index: number): boolean {
  return indexY(index) === TUNNEL_Y;
}

/**
 * Neighbour one tile over, wrapping across the tunnel row only. Returns -1
 * when the neighbour is off-board or not walkable.
 */
export function neighbourIndex(index: number, dx: number, dy: number): number {
  const x = indexX(index) + dx;
  const y = indexY(index) + dy;
  if (y === TUNNEL_Y && x < 0) return toIndex(BOARD_WIDTH - 1, y);
  if (y === TUNNEL_Y && x >= BOARD_WIDTH) return toIndex(0, y);
  if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return -1;
  const neighbour = toIndex(x, y);
  return isWalkable(neighbour) ? neighbour : -1;
}

export function createPellets(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(initialPellets) as Uint8Array<ArrayBuffer>;
}
