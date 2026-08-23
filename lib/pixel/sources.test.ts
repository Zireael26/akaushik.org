import { describe, expect, it } from 'vitest';
import type { FieldSource, SourceContext } from './field';
import { createStubContext, type StubContext } from './stub-context';
import { stage, pipeline, tileStage, STAGE_ORDER } from './stages';
import { neuralTraining } from './neural';
import {
  agentGraph,
  brokenGraph,
  errorGraph,
  layer,
  overloadedGraph,
  prompt,
  seedFrom,
  trellis,
  wordmark,
} from './sources';

/**
 * The source library had no unit tests at all — 2.25% coverage on the file that
 * decides what every canvas on the site draws.
 *
 * What is worth asserting here is narrow and deliberate. These are drawing
 * functions: there is no correct pixel to check, and a test that pinned exact
 * coordinates would fail on every intentional tweak to the art, which is how a
 * suite gets deleted. So the assertions are the properties the *engine* relies
 * on and a human would not notice breaking:
 *
 *   - it draws at all (a source wired to nothing is silent, not loud)
 *   - it is deterministic for a fixed context, or the field flickers
 *   - it responds to the inputs it claims to (`t`, `angle`, `seed`)
 *   - it puts marks on the grid at every size the presets use
 *
 * That last one is the reason for the small-grid cases. Every field is
 * responsive, so `cols`/`rows` vary with the viewport; art positioned in
 * absolute units lands off-grid at a phone width — visible at one breakpoint
 * and nowhere else, which is exactly the class of bug this project has already
 * shipped twice.
 */

const ctxFor = (source: FieldSource, c: Partial<SourceContext> = {}): StubContext => {
  const stub = createStubContext();
  source(stub, { cols: 120, rows: 54, angle: 0, t: 0, seed: 0, ...c });
  return stub;
};

/** Every named source, so the table-driven checks below cannot silently skip one. */
const SOURCES: Array<[string, FieldSource]> = [
  ['agentGraph', agentGraph],
  ['brokenGraph', brokenGraph],
  ['errorGraph', errorGraph],
  ['prompt', prompt],
  ['trellis', trellis],
  ['neuralTraining', neuralTraining],
  ['wordmark("AK.")', wordmark('AK.')],
  ...STAGE_ORDER.map((k): [string, FieldSource] => [`stage(${k})`, stage(k)]),
  ...STAGE_ORDER.map((k): [string, FieldSource] => [`tileStage(${k})`, tileStage(k)]),
  ['pipeline(all, null)', pipeline([...STAGE_ORDER], null)],
  ['pipeline(all, 2)', pipeline([...STAGE_ORDER], 2)],
];

describe.each(SOURCES)('%s', (name, source) => {
  it('draws something', () => {
    expect(ctxFor(source).calls.length).toBeGreaterThan(0);
  });

  it('is deterministic for identical input', () => {
    expect(ctxFor(source).signature()).toBe(ctxFor(source).signature());
  });

  it('emits only finite coordinates', () => {
    for (const [x, y] of ctxFor(source).points) {
      expect(Number.isFinite(x), `${name} drew a non-finite x`).toBe(true);
      expect(Number.isFinite(y), `${name} drew a non-finite y`).toBe(true);
    }
  });

  /**
   * Overlap, not containment.
   *
   * Containment is the obvious assertion and it is wrong: `trellis` draws a
   * field of diagonals deliberately wider than the grid and then `clip()`s
   * them, so points far outside the bounds are correct art, not a bug. Several
   * sources also let glow and stroke width spill past the edge on purpose.
   *
   * What genuinely breaks is art positioned in absolute units that lands
   * entirely off a small grid — invisible at one breakpoint and fine at every
   * other, which is the class of bug this project has shipped twice. So the
   * property is that the drawing overlaps the grid and puts at least one mark
   * inside it.
   */
  it.each([
    ['hero', 120, 54],
    ['band', 200, 22],
    ['tile', 40, 26],
    ['tiny', 24, 12],
  ])('draws inside a %s grid, not past it entirely', (_label, cols, rows) => {
    const { points } = ctxFor(source, { cols, rows });
    if (points.length === 0) return;

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    // Bounding box overlaps the grid at all.
    expect(Math.min(...xs)).toBeLessThan(cols);
    expect(Math.max(...xs)).toBeGreaterThan(0);
    expect(Math.min(...ys)).toBeLessThan(rows);
    expect(Math.max(...ys)).toBeGreaterThan(0);
    // And something is actually on screen.
    expect(
      points.some(([x, y]) => x >= 0 && x <= cols && y >= 0 && y <= rows),
      'every mark landed outside the grid',
    ).toBe(true);
  });

  it('draws on a degenerate 1x1 grid without throwing', () => {
    expect(() => ctxFor(source, { cols: 1, rows: 1 })).not.toThrow();
  });
});

describe('sources that respond to their inputs', () => {
  /**
   * `neuralTraining` is the one genuinely animated source — the hero mounts it
   * with `animate: 2` precisely so it advances. If `t` stopped mattering the
   * hero would freeze, and every existing test would still pass, because a
   * frozen canvas is a canvas.
   */
  it('neuralTraining advances with t', () => {
    expect(ctxFor(neuralTraining, { t: 0 }).signature()).not.toBe(
      ctxFor(neuralTraining, { t: 6.5 }).signature(),
    );
  });

  it('agentGraph rotates with angle', () => {
    expect(ctxFor(agentGraph, { angle: 0 }).signature()).not.toBe(
      ctxFor(agentGraph, { angle: 0.4 }).signature(),
    );
  });

  it('sources that ignore angle are unmoved by it', () => {
    // `prompt` and `trellis` do not destructure `angle`; if one starts to, this
    // is the test that says so rather than a mystery jitter on click.
    expect(ctxFor(prompt, { angle: 0 }).signature()).toBe(ctxFor(prompt, { angle: 1 }).signature());
    expect(ctxFor(trellis, { angle: 0 }).signature()).toBe(
      ctxFor(trellis, { angle: 1 }).signature(),
    );
  });
});

describe('the sources are actually different from each other', () => {
  /**
   * The assertion that fails if someone wires several fields to one function —
   * which is the live complaint about this codebase: every article header and
   * every case study currently renders the same `trellis`. Distinctness is the
   * property, so it gets a test.
   */
  it('every named source draws a distinct picture', () => {
    const seen = new Map<string, string>();
    for (const [name, source] of SOURCES) {
      const signature = ctxFor(source).signature();
      const clash = seen.get(signature);
      expect(clash, `${name} draws exactly the same picture as ${clash}`).toBeUndefined();
      seen.set(signature, name);
    }
  });
});

describe('wordmark', () => {
  it('draws different text differently', () => {
    expect(ctxFor(wordmark('AK.')).signature()).not.toBe(ctxFor(wordmark('ZZ.')).signature());
  });

  it('scales with its scale argument', () => {
    expect(ctxFor(wordmark('AK.', 0.3)).signature()).not.toBe(
      ctxFor(wordmark('AK.', 0.9)).signature(),
    );
  });

  it('renders the text it was given', () => {
    const fillText = ctxFor(wordmark('AK.')).calls.find((c) => c.fn === 'fillText');
    expect(fillText?.args[0]).toBe('AK.');
  });
});

describe('layer', () => {
  it('draws every part, in order', () => {
    const composed = ctxFor(layer(prompt, trellis));
    // `signature()` joins calls with '|', so concatenating two signatures needs
    // the same separator between them.
    const expected = [ctxFor(prompt).signature(), ctxFor(trellis).signature()].join('|');
    expect(composed.signature()).toBe(expected);
  });

  it('is order-sensitive', () => {
    expect(ctxFor(layer(prompt, trellis)).signature()).not.toBe(
      ctxFor(layer(trellis, prompt)).signature(),
    );
  });

  it('composing nothing draws nothing', () => {
    expect(ctxFor(layer()).calls).toHaveLength(0);
  });
});

describe('seedFrom', () => {
  it('is stable for the same input', () => {
    expect(seedFrom('building-this-portfolio')).toBe(seedFrom('building-this-portfolio'));
  });

  it('always returns a finite non-negative integer', () => {
    for (const s of ['', 'a', 'neev', 'a-very-long-slug-with-many-parts', '404']) {
      const seed = seedFrom(s);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * The whole point of the seed is that two article headers look different.
   * A hash that collided across the real corpus would defeat that silently, so
   * it is checked against the real slugs rather than invented ones.
   */
  it('does not collide across the actual content slugs', () => {
    const slugs = [
      'ai-for-msme',
      'best-practices-into-trellis',
      'building-this-portfolio',
      'detection-is-not-continuity',
      'fastembed-to-tei',
      'gptx-in-trellis',
      'micrograd-makemore',
      'native-git-hooks-for-non-node',
      'process-gate-stack-profiles',
      'renaming-projects',
      'trellis-1-0-rc',
      'trellis-loop-era',
      'trellis',
      'neev',
      'vericite',
      'bluehost-agents',
      'curat-money',
      'clusterbid',
    ];
    expect(new Set(slugs.map(seedFrom)).size).toBe(slugs.length);
  });
});

describe('stages', () => {
  it('names four stages, in order', () => {
    expect([...STAGE_ORDER]).toEqual(['read', 'spec', 'build', 'harden']);
  });

  it('draws a different glyph per stage', () => {
    const signatures = STAGE_ORDER.map((k) => ctxFor(stage(k)).signature());
    expect(new Set(signatures).size).toBe(STAGE_ORDER.length);
  });

  it('blooms tile art from a grid-space circle', () => {
    const rest = ctxFor(tileStage('build'), { cols: 40, rows: 26, progress: 0 });
    const half = ctxFor(tileStage('build'), { cols: 40, rows: 26, progress: 0.5 });
    const full = ctxFor(tileStage('build'), { cols: 40, rows: 26, progress: 1 });
    const restArc = rest.calls.find((call) => call.fn === 'arc');
    const halfArc = half.calls.find((call) => call.fn === 'arc');
    const fullArc = full.calls.find((call) => call.fn === 'arc');

    expect(restArc).toBeUndefined();
    expect(halfArc).toBeDefined();
    expect(fullArc).toBeDefined();
    expect(halfArc!.args[0]).toBe(20);
    expect(halfArc!.args[1]).toBe(13);
    expect(Number(halfArc!.args[2])).toBeLessThan(Number(fullArc!.args[2]));
    expect(rest.signature()).not.toBe(full.signature());
  });

  it('gives every tile its own simple icon', () => {
    const signatures = STAGE_ORDER.map((k) => ctxFor(tileStage(k)).signature());
    expect(new Set(signatures).size).toBe(STAGE_ORDER.length);
  });

  it('keeps tile icons distinct from the matching band drawings', () => {
    for (const kind of STAGE_ORDER) {
      expect(ctxFor(tileStage(kind)).signature()).not.toBe(ctxFor(stage(kind)).signature());
    }
  });

  /**
   * The emphasis shift is the entire interaction in the method section: the
   * band re-renders with a different active index and the field cross-fades.
   * If every index drew the same thing, hovering would do nothing and nothing
   * else in the suite would notice.
   */
  it('emphasises a different stage per active index', () => {
    const kinds = [...STAGE_ORDER];
    const signatures = [null, 0, 1, 2, 3].map((active) =>
      ctxFor(pipeline(kinds, active as number | null)).signature(),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('survives an out-of-range active index', () => {
    expect(() => ctxFor(pipeline([...STAGE_ORDER], 99))).not.toThrow();
    expect(() => ctxFor(pipeline([...STAGE_ORDER], -1))).not.toThrow();
  });

  it('draws nothing rather than throwing for an empty pipeline', () => {
    expect(() => ctxFor(pipeline([], null))).not.toThrow();
  });
});

describe('overloadedGraph', () => {
  it('is the error graph, and is documented as such', () => {
    expect(overloadedGraph).toBe(errorGraph);
  });
});

describe('the status graphs differ from the healthy one', () => {
  it('a broken graph is not a working graph', () => {
    expect(ctxFor(brokenGraph).signature()).not.toBe(ctxFor(agentGraph).signature());
  });

  it('an error graph is not a broken graph', () => {
    expect(ctxFor(errorGraph).signature()).not.toBe(ctxFor(brokenGraph).signature());
  });
});
