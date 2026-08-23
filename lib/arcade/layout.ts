const WALL = 0;
const PATH = 1;

export const BOARD_ROWS = [
  '#########################',
  '#P....#.....#.......#...#',
  '#.##..#.###.#.#####.#.#.#',
  '#.....#...#.#.....#...#.#',
  '###.#####.#.###.#.#####.#',
  '#...#.....#.....#.......#',
  '#.###.###.#####.###.###.#',
  '#.....#.....#.....#.#...#',
  '#.#####.###.#.###.#.#.###',
  '#.......#...#.#...#.....#',
  '#.###.#.#.###.#.#####.#.#',
  '#.#...#.#.....#.....#.#.#',
  '#.#.###.#####.#####.#.#.#',
  '#...#.......#...#...#...#',
  '#.#######.#.###.#.###.#.#',
  '#D.......#.....#....C..W#',
  '#########################',
] as const;

export const BOARD_WIDTH = BOARD_ROWS[0].length;
export const BOARD_HEIGHT = BOARD_ROWS.length;
export const BOARD_SIZE = BOARD_WIDTH * BOARD_HEIGHT;

export const PLAYER_SPAWN = findMarker('P');
export const DIRECT_SPAWN = findMarker('D');
export const CUTLINE_SPAWN = findMarker('C');
export const DRIFT_SPAWN = findMarker('W');
export const PURSUER_SPAWNS = [DIRECT_SPAWN, CUTLINE_SPAWN, DRIFT_SPAWN] as const;

const tiles = new Uint8Array(BOARD_SIZE);
const initialReadings = new Uint8Array(BOARD_SIZE);
let readingCount = 0;

for (let y = 0; y < BOARD_HEIGHT; y++) {
  const row = BOARD_ROWS[y]!;
  if (row.length !== BOARD_WIDTH) throw new Error(`Arcade row ${y} has width ${row.length}`);

  for (let x = 0; x < BOARD_WIDTH; x++) {
    const marker = row[x];
    const index = toIndex(x, y);
    if (marker === '#') {
      tiles[index] = WALL;
      continue;
    }

    tiles[index] = PATH;
    if (marker === '.') {
      initialReadings[index] = 1;
      readingCount++;
    }
  }
}

export const INITIAL_READING_COUNT = readingCount;

function findMarker(marker: 'P' | 'D' | 'C' | 'W'): number {
  for (let y = 0; y < BOARD_ROWS.length; y++) {
    const x = BOARD_ROWS[y]!.indexOf(marker);
    if (x >= 0) return y * BOARD_WIDTH + x;
  }
  throw new Error(`Arcade layout is missing ${marker}`);
}

export function toIndex(x: number, y: number): number {
  return y * BOARD_WIDTH + x;
}

export function indexX(index: number): number {
  return index % BOARD_WIDTH;
}

export function indexY(index: number): number {
  return Math.floor(index / BOARD_WIDTH);
}

export function isInside(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_WIDTH && y < BOARD_HEIGHT;
}

export function isWalkable(index: number): boolean {
  return index >= 0 && index < BOARD_SIZE && tiles[index] === PATH;
}

export function neighbourIndex(index: number, dx: number, dy: number): number {
  const x = indexX(index) + dx;
  const y = indexY(index) + dy;
  if (!isInside(x, y)) return -1;
  const neighbour = toIndex(x, y);
  return isWalkable(neighbour) ? neighbour : -1;
}

export function createReadings(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(initialReadings) as Uint8Array<ArrayBuffer>;
}
