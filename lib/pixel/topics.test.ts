/**
 * Contract tests for the per-topic writing art — `topics.ts`.
 *
 * Same discipline as `sources.test.ts`: a source is a drawing function, so
 * the tests hold it to what a drawing function can promise. Ink lands where
 * the design says the subject is (bounds, via the shared recorder), the
 * vocabulary is genuinely closed, resolution never throws, every source
 * animates off `t`, every frame is deterministic given a fixed `t` and seed,
 * and two slugs sharing one topic still differ — the last being the
 * regression guard for "someone wires every post to the same source".
 */
import { describe, expect, it } from 'vitest';
import type { SourceContext } from './field';
import { RecordingCtx } from './recording.test-utils';
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
  recorderOverrides?: { cols?: number; rows?: number },
): RecordingCtx {
  const o = new RecordingCtx(recorderOverrides);
  const source = topicSources[topic];
  const c: SourceContext = {
    cols: o.cols,
    rows: o.rows,
    angle: 0,
    t: 0,
    seed: 0,
    ...BASE,
    ...ctxOverrides,
  };
  source(o as unknown as CanvasRenderingContext2D, c);
  return o;
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

        expect(art.paints().length).toBeGreaterThan(0);
        const b = art.totalBounds();
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

describe('topics — animation and determinism', () => {
  it('every source animates: different t, different frame', () => {
    for (const topic of WRITING_ART_TOPICS) {
      const a = draw(topic, { t: 10 }, { cols: 200, rows: 40 });
      const b = draw(topic, { t: 90 }, { cols: 200, rows: 40 });
      expect(a.toJSON()).not.toBe(b.toJSON());
    }
  });

  it('every source is deterministic: same t and seed, identical frame', () => {
    for (const topic of WRITING_ART_TOPICS) {
      const a = draw(topic, {}, { cols: 200, rows: 40 });
      const b = draw(topic, {}, { cols: 200, rows: 40 });
      expect(a.toJSON()).toBe(b.toJSON());
    }
  });

  it('two slugs sharing a topic still differ in texture', () => {
    // Seeds RouteField derives from real slugs of one topic cluster.
    const a = draw('agent-process', { seed: 1234567 }, { cols: 200, rows: 40 });
    const b = draw('agent-process', { seed: 7654321 }, { cols: 200, rows: 40 });
    expect(a.toJSON()).not.toBe(b.toJSON());
  });

  it('different topics compose different frames from the same context', () => {
    // The regression guard for "someone wires every post to one source".
    const logs = WRITING_ART_TOPICS.map((topic) => draw(topic, {}, { cols: 200, rows: 40 }).toJSON());
    expect(new Set(logs).size).toBe(WRITING_ART_TOPICS.length);
  });
});
