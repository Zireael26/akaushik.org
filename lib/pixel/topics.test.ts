/**
 * Contract tests for the per-topic writing art — `topics.ts`.
 *
 * Same discipline as `sources.test.ts`: a source is a drawing function, so
 * the tests hold it to what a drawing function can promise. Ink lands where
 * the design says the subject is (bounds, via the shared recorder), the
 * vocabulary is genuinely closed, and these topic fields remain sparse traced
 * ink rather than dense filled cards. Every source animates off `t`, every
 * frame is deterministic given a fixed `t` and seed, and two slugs sharing one
 * topic still differ — the last being the regression guard for "someone wires
 * every post to the same source".
 */
import { describe, expect, it } from 'vitest';
import type { SourceContext } from './field';
import { createStubContext, type StubContext } from './stub-context';
import {
  WRITING_ART_TOPICS,
  asWritingArt,
  topicSource,
  topicSources,
  type WritingArt,
} from './topics';

/** Aspect regimes the route strip actually renders at (preset ÷ cell size). */
const REGIMES: Array<{ label: string; cols: number; rows: number }> = [
  { label: 'hero', cols: 138, rows: 80 },
  { label: 'band', cols: 300, rows: 40 },
  { label: 'strip', cols: 256, rows: 18 },
];

const BASE: Partial<SourceContext> = { angle: 0, t: 12, seed: 4242 };

function draw(
  topic: WritingArt,
  ctxOverrides: Partial<SourceContext> = {},
  size?: { cols?: number; rows?: number },
): StubContext {
  const stub = createStubContext();
  const source = topicSources[topic];
  const c: SourceContext = {
    cols: size?.cols ?? 200,
    rows: size?.rows ?? 40,
    angle: 0,
    t: 0,
    seed: 0,
    ...BASE,
    ...ctxOverrides,
  };
  source(stub, c);
  return stub;
}

/** Bounding box of every recorded point, or null when nothing was drawn. */
function bounds(
  points: StubContext['points'],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (points.length === 0) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

type FillRect = { width: number; height: number };

/** Filled geometry is allowed only for small packets, nodes, and receipts. */
function fillRects(art: StubContext): FillRect[] {
  return art.calls.flatMap<FillRect>(({ fn, args }) => {
    if (fn !== 'fillRect') return [];
    const [, , width, height] = args;
    return typeof width === 'number' && typeof height === 'number'
      ? [{ width: Math.abs(width), height: Math.abs(height) }]
      : [];
  });
}

function paintCounts(art: StubContext): { strokes: number; fills: number } {
  let strokes = 0;
  let fills = 0;
  for (const { fn } of art.calls) {
    if (fn === 'stroke' || fn === 'strokeRect') strokes++;
    if (fn === 'fill' || fn === 'fillRect') fills++;
  }
  return { strokes, fills };
}

describe('topics — the vocabulary is closed', () => {
  it('exposes exactly one source per declared topic', () => {
    expect(Object.keys(topicSources).sort()).toEqual([...WRITING_ART_TOPICS].sort());
  });

  it('resolves every declared topic to a drawable source', () => {
    for (const topic of WRITING_ART_TOPICS) {
      expect(topicSource(topic)).toBeTypeOf('function');
    }
  });

  it('resolves absent, empty, and unknown values to null without throwing', () => {
    expect(topicSource(undefined)).toBeNull();
    expect(topicSource(null)).toBeNull();
    expect(topicSource('')).toBeNull();
    expect(topicSource('trelis')).toBeNull(); // a typo, not silent success
    expect(asWritingArt('retrieval')).toBe('retrieval');
    expect(asWritingArt('retrievals')).toBeNull();
    expect(asWritingArt(42)).toBeNull();
  });
});

describe('topics — every source draws at every rendered aspect', () => {
  for (const topic of WRITING_ART_TOPICS) {
    for (const regime of REGIMES) {
      it(`${topic} puts non-empty, framed ink on a ${regime.label} grid`, () => {
        const art = draw(topic, {}, { cols: regime.cols, rows: regime.rows });

        expect(art.calls.length).toBeGreaterThan(0);
        const b = bounds(art.points);
        expect(b).not.toBeNull();

        // Composition stays inside the frame: sources read cols/rows rather
        // than assuming pixels, so nothing spills past the edges.
        expect(b!.minX).toBeGreaterThanOrEqual(-2);
        expect(b!.minY).toBeGreaterThanOrEqual(-2);
        expect(b!.maxX).toBeLessThanOrEqual(regime.cols + 2);
        expect(b!.maxY).toBeLessThanOrEqual(regime.rows + 2);

        // The subject occupies a meaningful share of the frame, so no
        // regime renders it down to invisible confetti.
        const w = b!.maxX - b!.minX;
        const h = b!.maxY - b!.minY;
        expect((w * h) / (regime.cols * regime.rows)).toBeGreaterThan(0.12);
      });
    }
  }
});

describe('topics — traced ink style', () => {
  for (const topic of WRITING_ART_TOPICS) {
    for (const regime of REGIMES) {
      it(`${topic} keeps strokes dominant and fills packet-sized on a ${regime.label} grid`, () => {
        for (const t of [0, 12, 90]) {
          const art = draw(topic, { t }, regime);
          const { strokes, fills } = paintCounts(art);
          const rects = fillRects(art);
          const frameArea = regime.cols * regime.rows;
          const fillArea = rects.reduce((sum, { width, height }) => sum + width * height, 0);

          // Rules and outlines carry the composition. Fills only punctuate it.
          expect(strokes).toBeGreaterThan(fills);
          expect(fillArea).toBeLessThanOrEqual(frameArea * 0.0125);

          // A single fill must never become a semantic card, grid cell, or bar.
          for (const { width, height } of rects) {
            expect(width * height).toBeLessThanOrEqual(frameArea * 0.0025);
            expect(width).toBeLessThanOrEqual(regime.cols * 0.08);
            expect(height).toBeLessThanOrEqual(regime.rows * 0.14);
          }
        }
      });
    }
  }
});

describe('topics — animation and determinism', () => {
  it('every source animates: different t, different frame', () => {
    for (const topic of WRITING_ART_TOPICS) {
      const a = draw(topic, { t: 10 }, { cols: 200, rows: 40 });
      const b = draw(topic, { t: 90 }, { cols: 200, rows: 40 });
      expect(a.signature()).not.toBe(b.signature());
    }
  });

  it('every source is deterministic: same t and seed, identical frame', () => {
    for (const topic of WRITING_ART_TOPICS) {
      const a = draw(topic, {}, { cols: 200, rows: 40 });
      const b = draw(topic, {}, { cols: 200, rows: 40 });
      expect(a.signature()).toBe(b.signature());
    }
  });

  it('every source carries distinct per-slug texture', () => {
    for (const topic of WRITING_ART_TOPICS) {
      const a = draw(topic, { seed: 1234567 }, { cols: 200, rows: 40 });
      const b = draw(topic, { seed: 7654321 }, { cols: 200, rows: 40 });
      expect(a.signature()).not.toBe(b.signature());
    }
  });

  it('different topics compose different frames from the same context', () => {
    // The regression guard for "someone wires every post to one source".
    const logs = WRITING_ART_TOPICS.map((topic) => draw(topic, {}, { cols: 200, rows: 40 }).signature());
    expect(new Set(logs).size).toBe(WRITING_ART_TOPICS.length);
  });
});
