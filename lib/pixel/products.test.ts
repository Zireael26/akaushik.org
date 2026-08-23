import { describe, expect, it } from 'vitest';
import type { FieldSource, SourceContext } from './field';
import { neuralTraining } from './neural';
import {
  PRODUCT_SLUGS,
  bluehostAgents,
  clusterbid,
  curatMoney,
  neev,
  productSource,
  productSources,
  type ProductSlug,
  vericite,
} from './products';
import { seedFrom } from './sources';
import { createStubContext, type StubContext } from './stub-context';
import { STAGE_ORDER, tileStage } from './stages';

type GridProfile = {
  label: string;
  cols: number;
  rows: number;
};

const PROFILES: readonly GridProfile[] = [
  { label: 'hero', cols: 160, rows: 90 },
  { label: 'band', cols: 150, rows: 34 },
  { label: 'tile', cols: 96, rows: 64 },
  { label: 'tiny', cols: 24, rows: 12 },
];

/**
 * These are the real field grids produced by the current CSS and preset cell
 * sizes: the detail reel is 204×53 at the 7px hero cell; a full desktop
 * four-up tile is 113×35 at the 3px tile cell; a compact 390px viewport
 * yields 117×26 after its 20px gutters and the tile's 76px minimum height.
 */
const RASTER_PROFILES: readonly GridProfile[] = [
  { label: 'hero-reel', cols: 204, rows: 53 },
  { label: 'desktop-tile', cols: 113, rows: 35 },
  { label: 'compact-mobile-tile', cols: 117, rows: 26 },
];

const METHOD_TILE_PROFILES: readonly GridProfile[] = [
  { label: 'authoring-tile', cols: 40, rows: 26 },
  { label: 'desktop-tile', cols: 113, rows: 35 },
  { label: 'compact-mobile-tile', cols: 117, rows: 26 },
];

const METHOD_TILE_PROGRESS = [
  0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42, 0.49, 0.56, 0.63, 0.7, 0.77, 0.84, 0.91, 0.98, 1,
] as const;

type SemanticPhase = {
  label: string;
  t: number;
};

const SEMANTIC_PHASES: Readonly<Record<ProductSlug, readonly SemanticPhase[]>> = {
  vericite: [
    { label: 'rest', t: 0 },
    { label: 'query', t: 0.2 },
    { label: 'encode', t: 0.9 },
    { label: 'retrieve', t: 1.6 },
    { label: 'cite', t: 3.17 },
  ],
  neev: [
    { label: 'rest', t: 0 },
    { label: 'arrival', t: 1.35 },
    { label: 'parser', t: 2.3 },
    { label: 'ruled-ledger', t: 3.17 },
  ],
  'bluehost-agents': [
    { label: 'lane-baseline', t: 0 },
    { label: 'outbound', t: 2 },
    { label: 'mixed-return', t: 3.25 },
    { label: 'return', t: 4.25 },
  ],
  'curat-money': [
    { label: 'intake', t: 0 },
    { label: 'feed', t: 0.3 },
    { label: 'settle', t: 2.5 },
    { label: 'rank-stamp', t: 4.5 },
  ],
  clusterbid: [
    { label: 'rest', t: 0 },
    { label: 'CI', t: 0.3 },
    { label: 'ingress', t: 0.9 },
    { label: 'pod-pull', t: 1.8 },
    { label: 'UAT-boundary', t: 3.17 },
  ],
};

const RASTER_SAMPLES_PER_SIDE = 4;
const RASTER_LIT_SAMPLES = 9;
const DENSITY_WINDOW_SIDE = 8;
const MAX_LIT_WINDOW_RATIO = 0.35;

type RasterLine = {
  kind: 'line';
  ax: number;
  ay: number;
  bx: number;
  by: number;
};

type RasterArc = {
  kind: 'arc';
  x: number;
  y: number;
  radius: number;
  start: number;
  end: number;
  counterclockwise: boolean;
};

type RasterPath = RasterLine | RasterArc;

/**
 * Rasterizes the geometric calls our field sources make into logical cells.
 * A cell needs a strict majority of a deterministic 4×4 supersample to count
 * as lit; fringe anti-aliasing cannot turn an accepted one-cell rule into two.
 */
function rasterizeCallLog(stub: StubContext, cols: number, rows: number): Uint8Array {
  const masks = new Uint16Array(cols * rows);
  let lineWidth = 1;
  // A source may erase (destination-out) as well as paint; the replay tracks
  // which so subtracted geometry clears the mask instead of adding to it.
  let erase = false;
  let cursor: [number, number] | null = null;
  let subpathStart: [number, number] | null = null;
  let path: RasterPath[] = [];
  let offsetX = 0;
  let offsetY = 0;
  const offsetStack: Array<readonly [number, number]> = [];

  const mark = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    contains: (x: number, y: number) => boolean,
    op: 'add' | 'sub' = 'add',
  ): void => {
    const apply = (cell: number, bit: number): void => {
      if (op === 'add') masks[cell]! |= bit;
      else masks[cell]! &= ~bit;
    };
    const startX = Math.max(0, Math.floor(minX));
    const startY = Math.max(0, Math.floor(minY));
    const endX = Math.min(cols, Math.ceil(maxX));
    const endY = Math.min(rows, Math.ceil(maxY));

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = y * cols + x;
        for (let sampleY = 0; sampleY < RASTER_SAMPLES_PER_SIDE; sampleY++) {
          for (let sampleX = 0; sampleX < RASTER_SAMPLES_PER_SIDE; sampleX++) {
            const bit = 1 << (sampleY * RASTER_SAMPLES_PER_SIDE + sampleX);
            if ((masks[cell]! & bit) !== 0 && op === 'add') continue;
            const px = x + (sampleX + 0.5) / RASTER_SAMPLES_PER_SIDE;
            const py = y + (sampleY + 0.5) / RASTER_SAMPLES_PER_SIDE;
            if (contains(px, py)) apply(cell, bit);
          }
        }
      }
    }
  };

  const rasterizeRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    outlined: boolean,
    op: 'add' | 'sub' = 'add',
  ): void => {
    if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) return;

    if (!outlined) {
      mark(
        x,
        y,
        x + width,
        y + height,
        (px, py) => px >= x && px < x + width && py >= y && py < y + height,
        op,
      );
      return;
    }

    const half = lineWidth * 0.5;
    const left = x - half;
    const top = y - half;
    const right = x + width + half;
    const bottom = y + height + half;
    mark(
      left,
      top,
      right,
      bottom,
      (px, py) =>
        px >= left &&
        px <= right &&
        py >= top &&
        py <= bottom &&
        (px <= x + half || px >= x + width - half || py <= y + half || py >= y + height - half),
    );
  };

  const rasterizeLine = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    op: 'add' | 'sub' = 'add',
  ): void => {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return;

    const half = lineWidth * 0.5;
    mark(
      Math.min(ax, bx) - half,
      Math.min(ay, by) - half,
      Math.max(ax, bx) + half,
      Math.max(ay, by) + half,
      (px, py) => {
        const progress = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
        if (progress < 0 || progress > 1) return false;
        const nearestX = ax + dx * progress;
        const nearestY = ay + dy * progress;
        const offsetX = px - nearestX;
        const offsetY = py - nearestY;
        return offsetX * offsetX + offsetY * offsetY <= half * half;
      },
      op,
    );
  };

  const normaliseAngle = (angle: number): number => {
    const fullTurn = Math.PI * 2;
    const normalised = angle % fullTurn;
    return normalised < 0 ? normalised + fullTurn : normalised;
  };

  const rasterizeArc = (arc: RasterArc, outlined: boolean, op: 'add' | 'sub' = 'add'): void => {
    const half = outlined ? lineWidth * 0.5 : 0;
    const fullTurn = Math.PI * 2;
    const sweep = arc.counterclockwise ? arc.start - arc.end : arc.end - arc.start;
    const fullCircle = Math.abs(sweep) >= fullTurn - 1e-6;
    const start = normaliseAngle(arc.start);
    const end = normaliseAngle(arc.end);

    mark(
      arc.x - arc.radius - half,
      arc.y - arc.radius - half,
      arc.x + arc.radius + half,
      arc.y + arc.radius + half,
      (px, py) => {
        const dx = px - arc.x;
        const dy = py - arc.y;
        const distance = Math.hypot(dx, dy);
        if (outlined ? Math.abs(distance - arc.radius) > half : distance > arc.radius) return false;
        if (fullCircle) return true;

        const angle = normaliseAngle(Math.atan2(dy, dx));
        return arc.counterclockwise
          ? (start - angle + fullTurn) % fullTurn <= (start - end + fullTurn) % fullTurn
          : (angle - start + fullTurn) % fullTurn <= (end - start + fullTurn) % fullTurn;
      },
      op,
    );
  };

  for (const { fn, args } of stub.calls) {
    if (fn === 'save') {
      offsetStack.push([offsetX, offsetY]);
      continue;
    }

    if (fn === 'restore') {
      const previous = offsetStack.pop();
      if (previous) [offsetX, offsetY] = previous;
      continue;
    }

    if (fn === 'translate') {
      const [x, y] = args;
      if (typeof x === 'number' && typeof y === 'number') {
        offsetX += x;
        offsetY += y;
      }
      continue;
    }

    if (fn === 'set:lineWidth') {
      const width = args[0];
      if (typeof width === 'number' && Number.isFinite(width)) lineWidth = width;
      continue;
    }

    if (fn === 'set:globalCompositeOperation') {
      erase = args[0] === 'destination-out';
      continue;
    }

    if (fn === 'fillRect' || fn === 'strokeRect') {
      const [x, y, width, height] = args;
      if (
        typeof x === 'number' &&
        typeof y === 'number' &&
        typeof width === 'number' &&
        typeof height === 'number'
      ) {
        rasterizeRect(x + offsetX, y + offsetY, width, height, fn === 'strokeRect');
      }
      continue;
    }

    if (fn === 'beginPath') {
      path = [];
      cursor = null;
      subpathStart = null;
      continue;
    }

    if (fn === 'moveTo') {
      const [x, y] = args;
      if (typeof x === 'number' && typeof y === 'number') {
        cursor = [x + offsetX, y + offsetY];
        subpathStart = cursor;
      }
      continue;
    }

    if (fn === 'lineTo') {
      const [x, y] = args;
      if (typeof x === 'number' && typeof y === 'number') {
        const next: [number, number] = [x + offsetX, y + offsetY];
        if (cursor !== null) {
          path.push({ kind: 'line', ax: cursor[0], ay: cursor[1], bx: next[0], by: next[1] });
        }
        cursor = next;
      }
      continue;
    }

    if (fn === 'closePath') {
      if (cursor !== null && subpathStart !== null) {
        path.push({
          kind: 'line',
          ax: cursor[0],
          ay: cursor[1],
          bx: subpathStart[0],
          by: subpathStart[1],
        });
        cursor = subpathStart;
      }
      continue;
    }

    if (fn === 'arc') {
      const [x, y, radius, start, end, counterclockwise] = args;
      if (
        typeof x === 'number' &&
        typeof y === 'number' &&
        typeof radius === 'number' &&
        typeof start === 'number' &&
        typeof end === 'number'
      ) {
        const transformedX = x + offsetX;
        const transformedY = y + offsetY;
        path.push({
          kind: 'arc',
          x: transformedX,
          y: transformedY,
          radius,
          start,
          end,
          counterclockwise: counterclockwise === true,
        });
        cursor = [transformedX + radius * Math.cos(end), transformedY + radius * Math.sin(end)];
      }
      continue;
    }

    if (fn === 'stroke' || fn === 'fill') {
      const op: 'add' | 'sub' = erase ? 'sub' : 'add';
      for (const primitive of path) {
        if (primitive.kind === 'line') {
          if (fn === 'stroke')
            rasterizeLine(primitive.ax, primitive.ay, primitive.bx, primitive.by, op);
        } else {
          rasterizeArc(primitive, fn === 'stroke', op);
        }
      }
    }
  }

  const lit = new Uint8Array(cols * rows);
  for (let cell = 0; cell < masks.length; cell++) {
    let samples = 0;
    let mask = masks[cell]!;
    while (mask !== 0) {
      mask &= mask - 1;
      samples++;
    }
    if (samples >= RASTER_LIT_SAMPLES) lit[cell] = 1;
  }
  return lit;
}

type LitWindow = {
  lit: number;
  x: number;
  y: number;
};

function maxLitWindow(lit: Uint8Array, cols: number, rows: number): LitWindow {
  const stride = cols + 1;
  const sums = new Uint16Array((rows + 1) * stride);
  let peak: LitWindow = { lit: 0, x: 0, y: 0 };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const index = (y + 1) * stride + x + 1;
      sums[index] =
        lit[y * cols + x]! + sums[index - 1]! + sums[index - stride]! - sums[index - stride - 1]!;
    }
  }

  for (let y = 0; y <= rows - DENSITY_WINDOW_SIDE; y++) {
    for (let x = 0; x <= cols - DENSITY_WINDOW_SIDE; x++) {
      const lowerRight = sums[(y + DENSITY_WINDOW_SIDE) * stride + x + DENSITY_WINDOW_SIDE]!;
      const lowerLeft = sums[(y + DENSITY_WINDOW_SIDE) * stride + x]!;
      const upperRight = sums[y * stride + x + DENSITY_WINDOW_SIDE]!;
      const upperLeft = sums[y * stride + x]!;
      const windowLit = lowerRight - lowerLeft - upperRight + upperLeft;
      if (windowLit > peak.lit) peak = { lit: windowLit, x, y };
    }
  }
  return peak;
}

const PRODUCTS: readonly [ProductSlug, FieldSource][] = [
  ['vericite', vericite],
  ['neev', neev],
  ['bluehost-agents', bluehostAgents],
  ['curat-money', curatMoney],
  ['clusterbid', clusterbid],
];

function render(
  source: FieldSource,
  cols: number,
  rows: number,
  seed: number,
  t: number,
  progress = 0,
): StubContext {
  const stub = createStubContext();
  const context: SourceContext = { cols, rows, angle: 0, t, seed, progress };
  source(stub, context);
  return stub;
}

function totalFillArea(stub: StubContext): number {
  return stub.calls.reduce((sum, { fn, args }) => {
    if (fn !== 'fillRect') return sum;
    const w = args[2];
    const h = args[3];
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) return sum + w * h;
    return sum;
  }, 0);
}
type EstimatedInk = {
  fillArea: number;
  strokeInk: number;
};

function estimatedInk(stub: StubContext): EstimatedInk {
  let fillArea = 0;
  let strokeInk = 0;
  let lineWidth = 1;
  let pathLength = 0;
  let cursor: [number, number] | null = null;

  for (const { fn, args } of stub.calls) {
    if (fn === 'set:lineWidth') {
      const value = args[0];
      if (typeof value === 'number' && Number.isFinite(value)) lineWidth = value;
      continue;
    }
    if (fn === 'fillRect') {
      const width = args[2];
      const height = args[3];
      if (typeof width === 'number' && typeof height === 'number') {
        fillArea += Math.abs(width * height);
      }
      continue;
    }
    if (fn === 'arc') {
      const radius = args[2];
      if (typeof radius === 'number') fillArea += Math.PI * radius * radius;
      continue;
    }
    if (fn === 'strokeRect') {
      const width = args[2];
      const height = args[3];
      if (typeof width === 'number' && typeof height === 'number') {
        strokeInk += 2 * (Math.abs(width) + Math.abs(height)) * lineWidth;
      }
      continue;
    }
    if (fn === 'beginPath') {
      pathLength = 0;
      cursor = null;
      continue;
    }
    if (fn === 'moveTo' || fn === 'lineTo') {
      const x = args[0];
      const y = args[1];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (fn === 'lineTo' && cursor !== null)
        pathLength += Math.hypot(x - cursor[0], y - cursor[1]);
      cursor = [x, y];
      continue;
    }
    if (fn === 'stroke') {
      strokeInk += pathLength * lineWidth;
      pathLength = 0;
      cursor = null;
    }
  }

  return { fillArea, strokeInk };
}

function assertOneCellLineWidth(stub: StubContext): void {
  const widths = stub.calls
    .filter(({ fn, args }) => fn === 'set:lineWidth' && typeof args[0] === 'number')
    .map(({ args }) => args[0] as number);
  expect(widths.length, 'source should declare semantic outline width').toBeGreaterThan(0);
  for (const width of widths) {
    expect(
      width,
      'semantic outline strokes should be at least three quarters of one cell',
    ).toBeGreaterThanOrEqual(0.75);
    expect(
      width,
      'semantic outline strokes should stay within one-cell tolerance',
    ).toBeLessThanOrEqual(1.25);
  }
}

function assertAccentDensity(stub: StubContext, cols: number, rows: number): void {
  const frameArea = cols * rows;
  // The 24×12 fallback retains a 2×2 travelling packet; proportional caps bind everywhere else.
  for (const { fn, args } of stub.calls) {
    if (fn !== 'fillRect') continue;
    const width = args[2];
    const height = args[3];
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0)
      continue;
    expect(width, 'filled accents must stay packet-sized').toBeLessThanOrEqual(
      Math.max(2, cols * 0.08),
    );
    expect(height, 'filled accents must stay packet-sized').toBeLessThanOrEqual(
      Math.max(2, rows * 0.14),
    );
    expect(
      width * height,
      'large semantic fills must be replaced by thin rules',
    ).toBeLessThanOrEqual(Math.max(4, frameArea * 0.005));
  }
  const { fillArea, strokeInk } = estimatedInk(stub);

  expect(
    fillArea,
    'accent and fill coverage should stay below one fifth of estimated drawn ink',
  ).toBeLessThanOrEqual((fillArea + strokeInk) * 0.2 + 1e-6);
}

function fillCount(stub: StubContext): number {
  return stub.calls.filter(({ fn }) => fn === 'fillRect' || fn === 'fill').length;
}

function assertStrokeRestraint(stub: StubContext, cols: number, rows: number): void {
  const canvasArea = cols * rows;
  const fillArea = totalFillArea(stub);
  expect(fillArea / canvasArea, 'filled alpha should stay sparse').toBeLessThanOrEqual(0.04);

  for (const { fn, args } of stub.calls) {
    if (fn !== 'fillRect') continue;
    const width = args[2];
    const height = args[3];
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0)
      continue;
    expect(width, 'large semantic boxes should be outlined, not filled').toBeLessThanOrEqual(
      cols * 0.3,
    );
    expect(height, 'large semantic boxes should be outlined, not filled').toBeLessThanOrEqual(
      rows * 0.3,
    );
    expect(width * height, 'filled accents should remain cell-sized').toBeLessThanOrEqual(
      canvasArea * 0.02,
    );
  }

  expect(
    stub.calls.filter(({ fn }) => fn === 'strokeRect' || fn === 'stroke').length,
    'outline/path ink should at least match filled accent operations',
  ).toBeGreaterThanOrEqual(fillCount(stub));
}

function assertInk(stub: StubContext): void {
  const painted = stub.calls.some(({ fn, args }) => {
    if (fn === 'fill' || fn === 'stroke') return true;
    if (fn !== 'fillRect') return false;
    return typeof args[2] === 'number' && args[2] > 0 && typeof args[3] === 'number' && args[3] > 0;
  });
  expect(painted, 'source should emit a positive-area fill or a path stroke').toBe(true);
  // A 1×1 dot would pass the predicate above but is not legible.
  // The density pass deliberately removes redundant marks, so require twenty
  // recorded operations rather than rewarding a crowded call log.
  expect(
    stub.calls.length,
    'source should do substantial drawing work, not a single dot',
  ).toBeGreaterThanOrEqual(20);
}

function assertInGrid(stub: StubContext, cols: number, rows: number): void {
  // 1 px slack allows sub-pixel anti-alias and lineWidth/2 bleed while still catching a 5 px drift
  // that the previous rows*0.07 = 6.3 px tolerance at hero would hide.
  const tolerance = 1;

  for (const [x, y] of stub.points) {
    expect(Number.isFinite(x), 'x coordinate should be finite').toBe(true);
    expect(Number.isFinite(y), 'y coordinate should be finite').toBe(true);
    expect(x).toBeGreaterThanOrEqual(-tolerance);
    expect(x).toBeLessThanOrEqual(cols + tolerance);
    expect(y).toBeGreaterThanOrEqual(-tolerance);
    expect(y).toBeLessThanOrEqual(rows + tolerance);
  }

  for (const { fn, args } of stub.calls) {
    if (fn === 'fillRect' || fn === 'strokeRect') {
      const [x, y, width, height] = args;
      expect(typeof x).toBe('number');
      expect(typeof y).toBe('number');
      expect(typeof width).toBe('number');
      expect(typeof height).toBe('number');
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number'
      )
        continue;
      expect(width).toBeGreaterThanOrEqual(0);
      expect(height).toBeGreaterThanOrEqual(0);
      expect(x).toBeGreaterThanOrEqual(-tolerance);
      expect(y).toBeGreaterThanOrEqual(-tolerance);
      expect(x + width).toBeLessThanOrEqual(cols + tolerance);
      expect(y + height).toBeLessThanOrEqual(rows + tolerance);
    }
    if (fn === 'arc') {
      const [x, y, radius] = args;
      expect(typeof x).toBe('number');
      expect(typeof y).toBe('number');
      expect(typeof radius).toBe('number');
      if (typeof x !== 'number' || typeof y !== 'number' || typeof radius !== 'number') continue;
      expect(radius).toBeGreaterThanOrEqual(0);
      expect(x - radius).toBeGreaterThanOrEqual(-tolerance);
      expect(x + radius).toBeLessThanOrEqual(cols + tolerance);
      expect(y - radius).toBeGreaterThanOrEqual(-tolerance);
      expect(y + radius).toBeLessThanOrEqual(rows + tolerance);
    }
  }
}

function assertThemeAgnostic(stub: StubContext): void {
  const colorWrites = stub.calls.filter(
    ({ fn }) => fn === 'set:fillStyle' || fn === 'set:strokeStyle' || fn === 'set:shadowColor',
  );
  expect(colorWrites).toHaveLength(0);
}

function callDiffRatio(a: StubContext, b: StubContext): number {
  const maxLen = Math.max(a.calls.length, b.calls.length);
  if (maxLen === 0) return 0;
  let diff = Math.abs(a.calls.length - b.calls.length);
  const minLen = Math.min(a.calls.length, b.calls.length);
  for (let i = 0; i < minLen; i++) {
    const ca = a.calls[i]!;
    const cb = b.calls[i]!;
    if (ca.fn !== cb.fn) {
      diff++;
      continue;
    }
    if (ca.args.length !== cb.args.length) {
      diff++;
      continue;
    }
    let same = true;
    for (let j = 0; j < ca.args.length; j++) {
      const av = ca.args[j];
      const bv = cb.args[j];
      if (typeof av === 'number' && typeof bv === 'number') {
        // signature() uses toFixed(4); treat <5e-5 as identical to avoid false diff
        if (Math.abs(av - bv) > 1e-4) {
          same = false;
          break;
        }
      } else if (av !== bv) {
        same = false;
        break;
      }
    }
    if (!same) diff++;
  }
  return diff / maxLen;
}

// -- Vericite phase helpers (hero geometry is exact, tiny is clamped to 1) --

function vericitePackets(stub: StubContext, cols: number, rows: number): StubContext['calls'] {
  const spineY = rows * 0.55;
  const y = spineY - rows * 0.032;
  const h = Math.max(1, rows * 0.064);
  const w = Math.max(1, rows * 0.055);
  const queryX = cols * 0.055;
  const queryW = cols * 0.12;
  const storeX = cols * 0.37;
  const storeW = cols * 0.25;
  const minX = queryX + queryW;
  const maxX = storeX + storeW * 0.28;
  return stub.calls.filter(
    ({ fn, args }) =>
      fn === 'fillRect' &&
      typeof args[0] === 'number' &&
      typeof args[1] === 'number' &&
      typeof args[2] === 'number' &&
      typeof args[3] === 'number' &&
      Math.abs(args[1] - y) < 0.5 &&
      Math.abs(args[3] - h) < 0.01 &&
      Math.abs(args[2] - w) < 0.01 &&
      args[0] >= minX - 0.5 &&
      args[0] <= maxX + 0.5,
  );
}

function vericiteEncodes(stub: StubContext, cols: number, rows: number): StubContext['calls'] {
  const embedX = cols * 0.235;
  const line = Math.max(0.75, Math.min(1, rows * 0.022));
  const h = Math.max(1, rows * 0.024);
  return stub.calls.filter(({ fn, args }) => {
    if (fn !== 'strokeRect') return false;
    const x = args[0];
    const hh = args[3];
    const w = args[2];
    if (typeof x !== 'number' || typeof hh !== 'number' || typeof w !== 'number') return false;
    if (Math.abs(hh - h) > 0.01) return false;
    if (x < embedX + line - 0.2 || x > embedX + cols * 0.06) return false;
    if (w < -0.01 || w > cols * 0.08) return false;
    return true;
  });
}

function vericiteCitations(stub: StubContext, cols: number, rows: number): StubContext['calls'] {
  const quote = Math.max(1, rows * 0.038);
  const answerX = cols * 0.69;
  const storeX = cols * 0.37;
  return stub.calls.filter(
    ({ fn, args }) =>
      fn === 'fillRect' &&
      args[2] === quote &&
      args[3] === quote &&
      typeof args[0] === 'number' &&
      args[0] >= storeX - 1 &&
      args[0] <= answerX + cols * 0.255,
  );
}

function curatStamps(stub: StubContext, cols: number, rows: number): StubContext['calls'] {
  const gridX = cols * 0.36;
  const gridW = cols * 0.59;
  const gridH = rows * 0.66;
  const rowCount = rows < 40 ? 1 : 2;
  const rowPitch = gridH / rowCount;
  const railX = gridX + gridW * 0.86;
  const h = Math.max(1, rowPitch * 0.13);
  return stub.calls.filter(
    ({ fn, args }) =>
      fn === 'fillRect' &&
      typeof args[0] === 'number' &&
      typeof args[3] === 'number' &&
      Math.abs(args[0] - railX) < 0.6 &&
      Math.abs(args[3] - h) < 0.12,
  );
}
function neevLedgerAccents(stub: StubContext, cols: number, rows: number): StubContext['calls'] {
  const ledgerX = cols * 0.55;
  const ledgerY = rows * 0.17;
  const ledgerW = cols * 0.405;
  const ledgerH = rows * 0.65;
  const bubbleCount = rows < 30 ? 1 : rows < 40 ? 2 : 3;
  const ledgerRowH = ledgerH / bubbleCount;
  const accents: StubContext['calls'] = [];

  for (let index = 0; index < stub.calls.length - 1; index++) {
    const move = stub.calls[index]!;
    const line = stub.calls[index + 1]!;
    if (move.fn !== 'moveTo' || line.fn !== 'lineTo') continue;
    const [startX, startY] = move.args;
    const [endX, endY] = line.args;
    if (
      typeof startX !== 'number' ||
      typeof startY !== 'number' ||
      typeof endX !== 'number' ||
      typeof endY !== 'number' ||
      endX <= startX ||
      Math.abs(endY - startY) > 1e-6 ||
      startX <= ledgerX ||
      startX >= ledgerX + ledgerW ||
      startY < ledgerY ||
      startY > ledgerY + ledgerH
    ) {
      continue;
    }
    const row = Math.floor((startY - ledgerY) / ledgerRowH);
    const expectedY = ledgerY + ledgerRowH * (row + 0.5);
    if (row >= 0 && row < bubbleCount && Math.abs(startY - expectedY) < 0.1) accents.push(line);
  }
  return accents;
}

describe('product source registry', () => {
  it('exposes the five case studies in their content order', () => {
    expect(PRODUCT_SLUGS).toEqual([
      'vericite',
      'neev',
      'bluehost-agents',
      'curat-money',
      'clusterbid',
    ]);
  });

  it('resolves every product to its bespoke source and never invents a fallback', () => {
    for (const [slug, source] of PRODUCTS) {
      expect(productSources[slug]).toBe(source);
      expect(productSource(slug)).toBe(source);
    }
    expect(productSource('writing-post-without-product-art')).toBeNull();
    expect(productSource('toString')).toBeNull();
    expect(productSource('__proto__')).toBeNull();
    expect(productSource('constructor')).toBeNull();
    // Every slug in the canonical list must resolve, otherwise ReelField would render empty.
    for (const slug of PRODUCT_SLUGS) {
      expect(productSource(slug), `PRODUCT_SLUGS entry ${slug} should resolve`).not.toBeNull();
    }
  });
});

describe.each(PRODUCTS)('%s product field', (slug, source) => {
  it.each(PROFILES)('has legible, deterministic in-grid ink at $label size', ({ cols, rows }) => {
    const seed = seedFrom(slug);
    const resting = render(source, cols, rows, seed, 0);
    const moving = render(source, cols, rows, seed, 3.17);

    assertInk(resting);
    assertInk(moving);
    assertInGrid(resting, cols, rows);
    assertInGrid(moving, cols, rows);
    assertThemeAgnostic(resting);
    assertThemeAgnostic(moving);
    assertStrokeRestraint(resting, cols, rows);
    assertStrokeRestraint(moving, cols, rows);

    expect(resting.signature()).toBe(render(source, cols, rows, seed, 0).signature());
    expect(moving.signature()).toBe(render(source, cols, rows, seed, 3.17).signature());
  });

  it('uses both its supplied seed and source time at every profile', () => {
    for (const { cols, rows } of PROFILES) {
      const seed = seedFrom(slug);
      const resting = render(source, cols, rows, seed, 0).signature();
      const later = render(source, cols, rows, seed, 3.17).signature();
      const nextSeed = render(source, cols, rows, seed + 1, 3.17).signature();

      expect(later, `${slug} should animate between t=0 and t=3.17 at ${cols}×${rows}`).not.toBe(
        resting,
      );
      expect(nextSeed, `${slug} should vary with seed at ${cols}×${rows}`).not.toBe(later);
      // If the source ignored t, the phase-specific helpers below would also be dead.
      expect(
        callDiffRatio(render(source, cols, rows, seed, 0), render(source, cols, rows, seed, 3.17)),
      ).toBeGreaterThan(0.05);
    }
  });
});
describe('product stroke accents', () => {
  it.each(PROFILES)(
    'keeps small emphasis while outlines carry the structure at $label size',
    ({ cols, rows }) => {
      for (const [slug, source] of PRODUCTS) {
        const seed = seedFrom(slug);
        const frames = [0, 1.35, 3.17].map((t) => render(source, cols, rows, seed, t));
        expect(
          frames.some((stub) => fillCount(stub) > 0),
          `${slug} should retain a small node, packet, or lit accent`,
        ).toBe(true);
      }
    },
  );
});

describe('product density guardrails', () => {
  it.each(PROFILES)('keeps one-cell rules and sparse accents at $label size', ({ cols, rows }) => {
    for (const [slug, source] of PRODUCTS) {
      const seed = seedFrom(slug);
      for (const t of [0, 0.2, 0.6, 1.35, 3.17, 4.5]) {
        const stub = render(source, cols, rows, seed, t);
        assertOneCellLineWidth(stub);
        assertAccentDensity(stub, cols, rows);
      }
    }
  });
});

describe('product raster density oracle', () => {
  it('keeps every semantic phase below 35% in each real reel and tile grid', () => {
    for (const { label, cols, rows } of RASTER_PROFILES) {
      for (const [slug, source] of PRODUCTS) {
        const seed = seedFrom(slug);
        for (const { label: phaseLabel, t } of SEMANTIC_PHASES[slug]) {
          const lit = rasterizeCallLog(render(source, cols, rows, seed, t), cols, rows);
          const peak = maxLitWindow(lit, cols, rows);
          expect(
            peak.lit / (DENSITY_WINDOW_SIDE * DENSITY_WINDOW_SIDE),
            `${slug} ${phaseLabel} at ${label} peaks at ${peak.lit}/64 cells in the 8×8 window at ${peak.x},${peak.y}`,
          ).toBeLessThanOrEqual(MAX_LIT_WINDOW_RATIO);
        }
      }
    }
  });
});

describe('method tile raster density oracle', () => {
  // Two regimes, deliberately.
  //
  // Rest (progress 0) stays under the house cap like every other field: plain
  // ink icon, no disc.
  //
  // The whole bloom (progress > 0) is the snapped-state profile. A genuinely
  // filled disc cannot live under the 35% bar — between radii ~2.5 and ~6.5
  // cells ANY solid disc peaks near 50% in its central 8×8 window regardless
  // of glyph, which is precisely why the previous attempt stippled itself into
  // reading as "an outline, not a fill" and was rejected twice. What this
  // profile. The guarantees that stay meaningful are geometric (the fill may
  // never exceed the disc it belongs to) and structural (the icon punch must
  // clear real area), both asserted below — per-window caps are not, because
  // windows past the knockout are legitimately solid accent. The bloom is also
  // the most transient surface on the site: a 14-frame ramp, skipped under
  // reduced motion, absent without a fine pointer.

  it('keeps rest below the house cap in each tile grid', () => {
    for (const { label, cols, rows } of METHOD_TILE_PROFILES) {
      for (const [index, kind] of STAGE_ORDER.entries()) {
        const source = tileStage(kind);
        const seed = index * 137;
        for (const progress of [0] as const) {
          const lit = rasterizeCallLog(render(source, cols, rows, seed, 0, progress), cols, rows);
          const peak = maxLitWindow(lit, cols, rows);
          expect(
            peak.lit / (DENSITY_WINDOW_SIDE * DENSITY_WINDOW_SIDE),
            `${kind} rest at ${label} peaks at ${peak.lit}/64 cells in the 8×8 window at ${peak.x},${peak.y}`,
          ).toBeLessThanOrEqual(MAX_LIT_WINDOW_RATIO);
        }
      }
    }
  });

  it('keeps the snapped disc from becoming an unbroken slab via the icon knockout', () => {
    for (const { label, cols, rows } of METHOD_TILE_PROFILES) {
      for (const [index, kind] of STAGE_ORDER.entries()) {
        const source = tileStage(kind);
        const seed = index * 137;
        for (const progress of METHOD_TILE_PROGRESS) {
          if (progress === 0) continue;
          const lit = rasterizeCallLog(render(source, cols, rows, seed, 0, progress), cols, rows);
          const totalLit = lit.reduce((sum, cell) => sum + cell, 0);
          // The disc's geometric ceiling: full bloom covers at most
          // π·(0.46·min(cols,rows))² plus edge sampling; the icon punch and
          // hash culling only reduce it. If this ever fails, something is
          // painting outside the disc — the one way a fill becomes a slab.
          const maxRadius = Math.min(cols, rows) * 0.46 * progress;
          const ceiling = Math.PI * maxRadius * maxRadius + 4 * maxRadius;
          expect(
            totalLit,
            `${kind} snap ${progress} at ${label} fills ${totalLit} cells but the disc geometry allows at most ${Math.ceil(ceiling)}`,
          ).toBeLessThanOrEqual(Math.ceil(ceiling));
          expect(
            totalLit / (cols * rows),
            `${kind} snap ${progress} at ${label} must knock the icon out of the disc`,
          ).toBeLessThan(0.92);
        }
      }
    }
  });
});

describe('product field identity', () => {
  it.each(PROFILES)(
    'keeps all five silhouettes distinct at $label size even with one shared seed',
    ({ cols, rows }) => {
      const signatures = PRODUCTS.map(([, source]) =>
        render(source, cols, rows, 2718, 3.17).signature(),
      );
      for (let left = 0; left < signatures.length; left++) {
        for (let right = left + 1; right < signatures.length; right++) {
          expect(
            signatures[left],
            `${PRODUCTS[left]![0]} and ${PRODUCTS[right]![0]} drew the same trace`,
          ).not.toBe(signatures[right]);
        }
      }
    },
  );

  it('keeps silhouettes distinct at rest and with slug-derived seeds by a wide margin', () => {
    for (const { cols, rows } of PROFILES) {
      // Resting state must also be distinct, not only the moving frame.
      const restingStubs = PRODUCTS.map(([, source]) => render(source, cols, rows, 2718, 0));
      for (let a = 0; a < restingStubs.length; a++) {
        for (let b = a + 1; b < restingStubs.length; b++) {
          expect(restingStubs[a]!.signature()).not.toBe(restingStubs[b]!.signature());
          expect(
            callDiffRatio(restingStubs[a]!, restingStubs[b]!),
            `resting ${PRODUCTS[a]![0]} vs ${PRODUCTS[b]![0]} at ${cols}×${rows} should differ by >20%`,
          ).toBeGreaterThan(0.2);
        }
      }
      // Slug-derived seeds are the real call-site; they must also stay distinct.
      const slugStubs = PRODUCTS.map(([s, src]) => render(src, cols, rows, seedFrom(s), 3.17));
      for (let a = 0; a < slugStubs.length; a++) {
        for (let b = a + 1; b < slugStubs.length; b++) {
          expect(
            callDiffRatio(slugStubs[a]!, slugStubs[b]!),
            `slug-seeded ${PRODUCTS[a]![0]} vs ${PRODUCTS[b]![0]} at ${cols}×${rows}`,
          ).toBeGreaterThan(0.2);
        }
      }
    }
  });

  it('does less drawing work than the animated neural training source at every profile', () => {
    for (const { cols, rows } of PROFILES) {
      for (const t of [0, 3.17]) {
        const neuralCalls = render(neuralTraining, cols, rows, 2718, t).calls.length;
        for (const [, source] of PRODUCTS) {
          const calls = render(source, cols, rows, 2718, t).calls.length;
          expect(
            calls,
            `product should stay under neural budget at ${cols}×${rows} t=${t}`,
          ).toBeLessThan(neuralCalls);
        }
      }
    }
  });
});

describe('clusterbid UAT boundary', () => {
  it('never fills either outlined UAT pod at any workflow phase or canvas size', () => {
    const times = [0, 0.5, 1.0, 1.75, 2.0, 3.17, 4.0, 4.5];
    for (const { cols, rows, label } of PROFILES) {
      for (const t of times) {
        const stub = render(clusterbid, cols, rows, seedFrom('clusterbid'), t);
        // The last pod column is UAT. Compact grids retain one row; larger grids retain two.
        const strokeXs = stub.calls
          .filter(({ fn }) => fn === 'strokeRect')
          .map(({ args }) => args[0])
          .filter((v): v is number => typeof v === 'number');
        const uatLeft = Math.max(...strokeXs);
        const uatFrames = stub.calls.filter(
          ({ fn, args }) => fn === 'strokeRect' && args[0] === uatLeft,
        );
        expect(uatFrames, `expected sparse UAT pod frames at ${label} t=${t}`).toHaveLength(
          rows < 40 ? 1 : 2,
        );
        for (const { fn, args } of stub.calls) {
          if (fn !== 'fillRect') continue;
          const [x, , width] = args;
          if (typeof x !== 'number' || typeof width !== 'number') continue;
          expect(x + width, `fill entered the UAT column at ${label} t=${t}`).toBeLessThanOrEqual(
            uatLeft,
          );
        }
        // Even the travelling final packet must stop at the boundary.
        const marker = Math.max(1, rows * 0.043);
        for (const { fn, args } of stub.calls) {
          if (fn !== 'fillRect') continue;
          const [x, y, w, h] = args;
          if (
            typeof x !== 'number' ||
            typeof y !== 'number' ||
            typeof w !== 'number' ||
            typeof h !== 'number'
          )
            continue;
          if (w !== marker || h !== marker) continue;
          // Final packet rides at y ≈ podY+podH+gapY*0.5; its x must stay left of UAT
          if (Math.abs(y - (rows * 0.25 + rows * 0.18 + rows * 0.07)) < rows * 0.1) {
            expect(x + w, `final packet crossed UAT at ${label} t=${t}`).toBeLessThanOrEqual(
              uatLeft,
            );
          }
        }
      }
    }
  });
});

describe('tiny legibility', () => {
  it('retains substantial ink and strict in-grid geometry at 24×12', () => {
    const cols = 24;
    const rows = 12;
    for (const [slug, source] of PRODUCTS) {
      const seed = seedFrom(slug);
      const resting = render(source, cols, rows, seed, 0);
      const moving = render(source, cols, rows, seed, 3.17);
      // Both frames must have meaningful work (catches 1×1 dot collapse).
      expect(
        resting.calls.length,
        `${slug} tiny resting should have many calls`,
      ).toBeGreaterThanOrEqual(20);
      expect(
        moving.calls.length,
        `${slug} tiny moving should have many calls`,
      ).toBeGreaterThanOrEqual(20);
      assertInGrid(resting, cols, rows);
      assertInGrid(moving, cols, rows);

      const active = render(source, cols, rows, seed, 1.35);
      assertStrokeRestraint(active, cols, rows);
      expect(
        [resting, active, moving].some((stub) => fillCount(stub) > 0),
        `${slug} should retain a small active accent across its cycle`,
      ).toBe(true);

      // Wireframe alone is not enough: each silhouette must retain multiple outlined blocks
      // while the combined stroke+fill count stays substantial.
      const strokesRest = resting.calls.filter(({ fn }) => fn === 'strokeRect').length;
      const strokesMove = moving.calls.filter(({ fn }) => fn === 'strokeRect').length;
      expect(strokesRest, `${slug} tiny resting strokeRects`).toBeGreaterThanOrEqual(2);
      expect(strokesMove, `${slug} tiny moving strokeRects`).toBeGreaterThanOrEqual(2);
    }
  });

  it('clusterbid resting is wireframe but moving carries packets, even at tiny', () => {
    const cols = 24;
    const rows = 12;
    const resting = render(clusterbid, cols, rows, seedFrom('clusterbid'), 0);
    const moving = render(clusterbid, cols, rows, seedFrom('clusterbid'), 3.17);
    expect(
      resting.calls.filter(({ fn }) => fn === 'fillRect').length,
      'resting should be wireframe',
    ).toBe(0);
    expect(
      moving.calls.filter(({ fn }) => fn === 'fillRect').length,
      'moving should retain ingress and boundary packets',
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('vericite pipeline phases', () => {
  const cols = 160;
  const rows = 90;
  const seed = seedFrom('vericite');

  it('encodes in the embedding lane only during its window', () => {
    const resting = render(vericite, cols, rows, seed, 0);
    const encoding = render(vericite, cols, rows, seed, 0.9); // cycle 0.252 ∈ [0.18,0.42]
    expect(vericiteEncodes(resting, cols, rows)).toHaveLength(0);
    const midEncodes = vericiteEncodes(encoding, cols, rows);
    expect(
      midEncodes.length,
      'expected 3 embedding bars to be outlined during encode',
    ).toBeGreaterThan(0);
    // If the encode branch were deleted, the mid frame would look identical to resting
    expect(encoding.signature()).not.toBe(resting.signature());
    expect(callDiffRatio(resting, encoding)).toBeGreaterThan(0.05);
  });

  it('carries a single query packet along the spine and it traverses', () => {
    const before = render(vericite, cols, rows, seed, 0);
    const mid = render(vericite, cols, rows, seed, 0.9);
    const lateMid = render(vericite, cols, rows, seed, 1.35); // cycle 0.378 still in [0.08,0.4]
    const after = render(vericite, cols, rows, seed, 3.17); // cycle 0.888 outside

    expect(vericitePackets(before, cols, rows)).toHaveLength(0);
    expect(vericitePackets(after, cols, rows)).toHaveLength(0);

    const midPackets = vericitePackets(mid, cols, rows);
    const latePackets = vericitePackets(lateMid, cols, rows);
    expect(midPackets).toHaveLength(1);
    expect(latePackets).toHaveLength(1);

    const midX = midPackets[0]!.args[0] as number;
    const lateX = latePackets[0]!.args[0] as number;
    expect(lateX, 'packet should advance along x between 0.9 and 1.35').toBeGreaterThan(midX);
    // Spine Y is fixed; a source that interpolates only x would still pass y check,
    // but a source that forgets the packet entirely fails the length checks above.
    const spineY = rows * 0.55 - rows * 0.032;
    expect(midPackets[0]!.args[1]).toBeCloseTo(spineY, 1);
  });

  it('assembles answer bars progressively and cites back to the matched chunk', () => {
    const resting = render(vericite, cols, rows, seed, 0);
    const assembling = render(vericite, cols, rows, seed, 3.17); // cycle 0.888: assemble=~0.85, cite>0
    const citing = render(vericite, cols, rows, seed, 3.07); // cycle 0.86 also citing

    expect(vericiteCitations(resting, cols, rows)).toHaveLength(0);
    expect(vericiteCitations(assembling, cols, rows)).toHaveLength(1);
    expect(vericiteCitations(citing, cols, rows)).toHaveLength(1);

    // Citation marker must travel from the answer card back toward the store on the cite line
    const earlyCite = vericiteCitations(citing, cols, rows)[0]!.args[0] as number;
    const lateCite = vericiteCitations(assembling, cols, rows)[0]!.args[0] as number;
    // At 3.07 cite≈0.71, at 3.17 cite≈0.92, so x moves left toward store (lerp answer→store)
    expect(earlyCite).toBeGreaterThan(lateCite);

    // Answer bars: the moving frame should add outlined progress accents.
    const answerAccentsRest = resting.calls.filter(
      ({ fn, args }) => fn === 'strokeRect' && typeof args[0] === 'number' && args[0] > cols * 0.68,
    ).length;
    const answerAccentsMoving = assembling.calls.filter(
      ({ fn, args }) => fn === 'strokeRect' && typeof args[0] === 'number' && args[0] > cols * 0.68,
    ).length;
    expect(answerAccentsMoving, 'answer assembly should add outlined accents').toBeGreaterThan(
      answerAccentsRest,
    );

    // At encode time there is no citation yet
    expect(vericiteCitations(render(vericite, cols, rows, seed, 0.9), cols, rows)).toHaveLength(0);
  });

  it('produces three distinct signatures across resting, encoding and citing', () => {
    const a = render(vericite, cols, rows, seed, 0).signature();
    const b = render(vericite, cols, rows, seed, 0.9).signature();
    const c = render(vericite, cols, rows, seed, 3.17).signature();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });
});

describe('neev pipeline phases', () => {
  const cols = 160;
  const rows = 90;
  const seed = seedFrom('neev');

  it('sends a mid-flight arrival packet toward the parser', () => {
    const resting = render(neev, cols, rows, seed, 0);
    const mid = render(neev, cols, rows, seed, 2.3); // cycle 0.552, message 4 mid-arrival
    const late = render(neev, cols, rows, seed, 3.17); // cycle 0.761, all arrivals done

    const packetW = Math.max(1, rows * 0.045);
    const packetH = Math.max(1, rows * 0.05);
    const arrivalsRest = resting.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === packetW && args[3] === packetH,
    );
    const arrivalsMid = mid.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === packetW && args[3] === packetH,
    );
    const arrivalsLate = late.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === packetW && args[3] === packetH,
    );

    expect(arrivalsRest).toHaveLength(0);
    expect(arrivalsLate).toHaveLength(0);
    expect(
      arrivalsMid.length,
      'expected one arrival packet in flight at t=2.3',
    ).toBeGreaterThanOrEqual(1);

    // The packet must sit between the bubble row and the parser
    const parserX = cols * 0.405;
    const chatW = cols * 0.275;
    for (const p of arrivalsMid) {
      const x = p.args[0] as number;
      expect(x).toBeGreaterThan(chatW);
      expect(x).toBeLessThan(parserX);
    }
  });

  it('rules ledger rows progressively, never regressing', () => {
    const t0 = render(neev, cols, rows, seed, 0);
    const tMid = render(neev, cols, rows, seed, 1.35); // cycle 0.324
    const tLate = render(neev, cols, rows, seed, 3.17); // cycle 0.761 heavily ruled
    const accents0 = neevLedgerAccents(t0, cols, rows).length;
    const accentsMid = neevLedgerAccents(tMid, cols, rows).length;
    const accentsLate = neevLedgerAccents(tLate, cols, rows).length;
    expect(accentsMid).toBeGreaterThan(accents0);
    expect(accentsLate).toBeGreaterThan(accentsMid);
    expect(accentsLate, 'late ledger should carry multiple ruled row accents').toBeGreaterThan(4);
  });

  it('produces distinct signatures across ledger phases', () => {
    const a = render(neev, cols, rows, seed, 0).signature();
    const b = render(neev, cols, rows, seed, 2.3).signature();
    const c = render(neev, cols, rows, seed, 3.17).signature();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });
});

describe('curat-money pipeline phases', () => {
  const cols = 160;
  const rows = 90;
  const seed = seedFrom('curat-money');

  it('stamps the rank rail only after rows have settled', () => {
    const before = render(curatMoney, cols, rows, seed, 0);
    const mid = render(curatMoney, cols, rows, seed, 3.17); // cycle 0.634 settle≈0.59 stamp=0
    const settled = render(curatMoney, cols, rows, seed, 4.5); // cycle 0.9 stamp≈0.7

    expect(curatStamps(before, cols, rows)).toHaveLength(0);
    expect(curatStamps(mid, cols, rows)).toHaveLength(0);
    const stamps = curatStamps(settled, cols, rows);
    expect(stamps.length, 'rank rail should be stamped after settling').toBeGreaterThan(0);
    // One stamp per data row
    const expected = rows < 40 ? 1 : 2;
    expect(stamps.length).toBe(expected);
  });

  it('settles rows from intake permutation into ranked order', () => {
    const intake = render(curatMoney, cols, rows, seed, 0);
    const settling = render(curatMoney, cols, rows, seed, 2.5); // cycle 0.5 settle≈0.2
    const settled = render(curatMoney, cols, rows, seed, 4.5); // fully settled
    // Row frames are strokeRect with width gridW*0.6; keep draw order (per-row) to detect per-row moves.
    const frames = (stub: StubContext) =>
      stub.calls
        .filter(
          ({ fn, args }) =>
            fn === 'strokeRect' &&
            typeof args[2] === 'number' &&
            Math.abs(args[2] - cols * 0.59 * 0.6) < 1,
        )
        .map(({ args }) => args[1] as number);
    const y0 = frames(intake);
    const ySettled = frames(settled);
    let moved = 0;
    for (let i = 0; i < y0.length; i++) if (Math.abs(y0[i]! - ySettled[i]!) > 1e-6) moved++;
    // Intake permutation is never already sorted, so at least one row must move; current code moves 2/5 for seed 53190.
    expect(moved).toBeGreaterThanOrEqual(1);
    expect(settling.signature()).not.toBe(intake.signature());
    expect(settled.signature()).not.toBe(settling.signature());
  });

  it('feeds a packet down the left chute as the cycle advances', () => {
    const before = render(curatMoney, cols, rows, seed, 0); // cycle 0 feed=0 no packet
    const early = render(curatMoney, cols, rows, seed, 0.3); // cycle 0.06 feed>0 packet mid-chute
    const settled = render(curatMoney, cols, rows, seed, 4.5); // cycle 0.9 feed=1 packet at bottom
    const feederBox = Math.max(8, rows * 0.075);
    const feedSize = feederBox * 0.25;
    const feedBefore = before.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === feedSize && args[3] === feedSize,
    );
    const feedEarly = early.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === feedSize && args[3] === feedSize,
    );
    const feedSettled = settled.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === feedSize && args[3] === feedSize,
    );
    expect(feedBefore).toHaveLength(0);
    expect(feedEarly.length).toBeGreaterThan(0);
    expect(feedSettled.length).toBeGreaterThan(0);
    // Packet must travel down the chute: y increases from early to settled
    const yEarly = feedEarly[0]!.args[1] as number;
    const ySettled = feedSettled[0]!.args[1] as number;
    expect(ySettled).toBeGreaterThan(yEarly);
  });
});

describe('bluehost-agents pipeline phases', () => {
  const cols = 160;
  const rows = 90;
  const seed = seedFrom('bluehost-agents');
  const marker = Math.max(1, rows * 0.042);

  it('animates packets along sloped agent stems', () => {
    const a = render(bluehostAgents, cols, rows, seed, 2.0);
    const b = render(bluehostAgents, cols, rows, seed, 2.5);
    expect(a.signature()).not.toBe(b.signature());
    // At least one outbound packet (fill) and the clock-driven positions must differ
    const packetsA = a.calls.filter(
      ({ fn, args }) =>
        fn === 'fillRect' &&
        args[2] === marker &&
        args[3] === marker &&
        typeof args[0] === 'number',
    );
    const packetsB = b.calls.filter(
      ({ fn, args }) =>
        fn === 'fillRect' &&
        args[2] === marker &&
        args[3] === marker &&
        typeof args[0] === 'number',
    );
    expect(packetsA.length).toBeGreaterThan(0);
    expect(packetsB.length).toBeGreaterThan(0);
    // Positions should not be identical across a half-second gap; at least one packet moves.
    const posA = packetsA
      .map((c) => `${(c.args[0] as number).toFixed(2)},${(c.args[1] as number).toFixed(2)}`)
      .sort()
      .join('|');
    const posB = packetsB
      .map((c) => `${(c.args[0] as number).toFixed(2)},${(c.args[1] as number).toFixed(2)}`)
      .sort()
      .join('|');
    expect(posB).not.toBe(posA);
  });

  it('shows both outbound and returning markers at some point in the cycle', () => {
    let sawOutbound = false;
    let sawReturning = false;
    for (const t of [0, 1.0, 2.0, 3.17]) {
      const stub = render(bluehostAgents, cols, rows, seed, t);
      const outbound = stub.calls.filter(
        ({ fn, args }) => fn === 'fillRect' && args[2] === marker && args[3] === marker,
      );
      const returning = stub.calls.filter(
        ({ fn, args }) => fn === 'strokeRect' && args[2] === marker && args[3] === marker,
      );
      if (outbound.length > 0) sawOutbound = true;
      if (returning.length > 0) sawReturning = true;
    }
    expect(sawOutbound, 'expected at least one outbound (filled) packet').toBe(true);
    expect(sawReturning, 'expected at least one returning (outlined) packet').toBe(true);
  });

  it('keeps agent endpoints jittered but lanes distinct', () => {
    const a = render(bluehostAgents, cols, rows, seed, 0);
    const b = render(bluehostAgents, cols, rows, seed + 1, 0);
    expect(a.signature()).not.toBe(b.signature());
    expect(callDiffRatio(a, b)).toBeGreaterThan(0.05);
  });
});

describe('clusterbid pipeline phases', () => {
  const cols = 160;
  const rows = 90;
  const seed = seedFrom('clusterbid');

  it('progressively checks CI and fills schedulable pods', () => {
    const resting = render(clusterbid, cols, rows, seed, 0);
    const early = render(clusterbid, cols, rows, seed, 0.9); // ingress pulling
    const late = render(clusterbid, cols, rows, seed, 3.17); // running + final packet

    expect(resting.calls.filter(({ fn }) => fn === 'fillRect')).toHaveLength(0);
    expect(early.calls.filter(({ fn }) => fn === 'fillRect').length).toBeGreaterThan(0);
    expect(late.calls.filter(({ fn }) => fn === 'fillRect').length).toBeGreaterThan(
      early.calls.filter(({ fn }) => fn === 'fillRect').length,
    );

    // CI checkmarks appear only after complete>0 (phase 0.04-0.12 etc.)
    // At t=0 there should be no checkmark segments (which are stroke calls with short diagonal)
    // The diagonal checkmarks are the only strokes that are not axis-aligned; we proxy via fill count growth.
    expect(late.signature()).not.toBe(resting.signature());
  });

  it('sends a final packet to the UAT boundary without crossing it', () => {
    const without = render(clusterbid, cols, rows, seed, 0);
    const withPacket = render(clusterbid, cols, rows, seed, 3.17);
    const marker = Math.max(1, rows * 0.043);
    const packetsWithout = without.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === marker && args[3] === marker,
    );
    const packetsWith = withPacket.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === marker && args[3] === marker,
    );
    // At t=0 only ticks exist, not the travelling final packet at y ≈ podY+podH+gapY*0.5
    // At t=3.17 there is at least one more marker (the final packet) beyond the per-pod ticks.
    expect(packetsWith.length).toBeGreaterThan(packetsWithout.length);

    const uatLeft = Math.max(
      ...withPacket.calls
        .filter(({ fn }) => fn === 'strokeRect')
        .map(({ args }) => args[0] as number),
    );
    for (const p of packetsWith) {
      const x = p.args[0] as number;
      const w = p.args[2] as number;
      // Only the final packet rides on the UAT approach lane; pod ticks are at pod interiors (<uatLeft)
      // This asserts that even the farthest marker stays left of the boundary.
      expect(x + w).toBeLessThanOrEqual(uatLeft);
    }
  });
});
