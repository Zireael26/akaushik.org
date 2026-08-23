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

const PRODUCTS: readonly [ProductSlug, FieldSource][] = [
  ['vericite', vericite],
  ['neev', neev],
  ['bluehost-agents', bluehostAgents],
  ['curat-money', curatMoney],
  ['clusterbid', clusterbid],
];

function render(source: FieldSource, cols: number, rows: number, seed: number, t: number): StubContext {
  const stub = createStubContext();
  const context: SourceContext = { cols, rows, angle: 0, t, seed };
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

function assertInk(stub: StubContext): void {
  const painted = stub.calls.some(({ fn, args }) => {
    if (fn === 'fill' || fn === 'stroke') return true;
    if (fn !== 'fillRect') return false;
    return typeof args[2] === 'number' && args[2] > 0 && typeof args[3] === 'number' && args[3] > 0;
  });
  expect(painted, 'source should emit a positive-area fill or a path stroke').toBe(true);
  // A 1×1 dot would pass the predicate above but is not legible.
  // All real products emit 55–180 calls even at tiny; a degenerate source with 1–2 calls must fail.
  expect(stub.calls.length, 'source should do substantial drawing work, not a single dot').toBeGreaterThan(40);
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
      if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') continue;
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
  const colorWrites = stub.calls.filter(({ fn }) =>
    fn === 'set:fillStyle' || fn === 'set:strokeStyle' || fn === 'set:shadowColor',
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
  const line = Math.max(1, rows * 0.022);
  const h = Math.max(1, rows * 0.024);
  return stub.calls.filter(({ fn, args }) => {
    if (fn !== 'fillRect') return false;
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
  const rowCount = rows < 40 ? 4 : 5;
  const rowPitch = gridH / rowCount;
  const railX = gridX + gridW * 0.955;
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

    expect(resting.signature()).toBe(render(source, cols, rows, seed, 0).signature());
    expect(moving.signature()).toBe(render(source, cols, rows, seed, 3.17).signature());
  });

  it('uses both its supplied seed and source time at every profile', () => {
    for (const { cols, rows } of PROFILES) {
      const seed = seedFrom(slug);
      const resting = render(source, cols, rows, seed, 0).signature();
      const later = render(source, cols, rows, seed, 3.17).signature();
      const nextSeed = render(source, cols, rows, seed + 1, 3.17).signature();

      expect(later, `${slug} should animate between t=0 and t=3.17 at ${cols}×${rows}`).not.toBe(resting);
      expect(nextSeed, `${slug} should vary with seed at ${cols}×${rows}`).not.toBe(later);
      // If the source ignored t, the phase-specific helpers below would also be dead.
      expect(callDiffRatio(render(source, cols, rows, seed, 0), render(source, cols, rows, seed, 3.17))).toBeGreaterThan(0.05);
    }
  });
});

describe('product field identity', () => {
  it.each(PROFILES)('keeps all five silhouettes distinct at $label size even with one shared seed', ({ cols, rows }) => {
    const signatures = PRODUCTS.map(([, source]) => render(source, cols, rows, 2718, 3.17).signature());
    for (let left = 0; left < signatures.length; left++) {
      for (let right = left + 1; right < signatures.length; right++) {
        expect(signatures[left], `${PRODUCTS[left]![0]} and ${PRODUCTS[right]![0]} drew the same trace`).not.toBe(
          signatures[right],
        );
      }
    }
  });

  it('keeps silhouettes distinct at rest and with slug-derived seeds by a wide margin', () => {
    for (const { cols, rows } of PROFILES) {
      // Resting state must also be distinct, not only the moving frame.
      const restingStubs = PRODUCTS.map(([, source]) => render(source, cols, rows, 2718, 0));
      for (let a = 0; a < restingStubs.length; a++) {
        for (let b = a + 1; b < restingStubs.length; b++) {
          expect(restingStubs[a]!.signature()).not.toBe(restingStubs[b]!.signature());
          expect(callDiffRatio(restingStubs[a]!, restingStubs[b]!), `resting ${PRODUCTS[a]![0]} vs ${PRODUCTS[b]![0]} at ${cols}×${rows} should differ by >20%`).toBeGreaterThan(0.2);
        }
      }
      // Slug-derived seeds are the real call-site; they must also stay distinct.
      const slugStubs = PRODUCTS.map(([s, src]) => render(src, cols, rows, seedFrom(s), 3.17));
      for (let a = 0; a < slugStubs.length; a++) {
        for (let b = a + 1; b < slugStubs.length; b++) {
          expect(callDiffRatio(slugStubs[a]!, slugStubs[b]!), `slug-seeded ${PRODUCTS[a]![0]} vs ${PRODUCTS[b]![0]} at ${cols}×${rows}`).toBeGreaterThan(0.2);
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
          expect(calls, `product should stay under neural budget at ${cols}×${rows} t=${t}`).toBeLessThan(neuralCalls);
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
        // UAT pods are the two rightmost pod frames (column 2, two rows).
        const strokeXs = stub.calls
          .filter(({ fn }) => fn === 'strokeRect')
          .map(({ args }) => args[0])
          .filter((v): v is number => typeof v === 'number');
        const uatLeft = Math.max(...strokeXs);
        const uatFrames = stub.calls.filter(({ fn, args }) => fn === 'strokeRect' && args[0] === uatLeft);
        expect(uatFrames, `expected 2 UAT pod frames at ${label} t=${t}`).toHaveLength(2);
        for (const { fn, args } of stub.calls) {
          if (fn !== 'fillRect') continue;
          const [x, , width] = args;
          if (typeof x !== 'number' || typeof width !== 'number') continue;
          expect(x + width, `fill entered the UAT column at ${label} t=${t}`).toBeLessThanOrEqual(uatLeft);
        }
        // Even the travelling final packet must stop at the boundary.
        const marker = Math.max(1, rows * 0.043);
        for (const { fn, args } of stub.calls) {
          if (fn !== 'fillRect') continue;
          const [x, y, w, h] = args;
          if (typeof x !== 'number' || typeof y !== 'number' || typeof w !== 'number' || typeof h !== 'number') continue;
          if (w !== marker || h !== marker) continue;
          // Final packet rides at y ≈ podY+podH+gapY*0.5; its x must stay left of UAT
          if (Math.abs(y - (rows * 0.25 + rows * 0.18 + rows * 0.07)) < rows * 0.1) {
            expect(x + w, `final packet crossed UAT at ${label} t=${t}`).toBeLessThanOrEqual(uatLeft);
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
      // Both frames must have meaningful work (catches 1×1 dot collapse)
      expect(resting.calls.length, `${slug} tiny resting should have many calls`).toBeGreaterThan(40);
      expect(moving.calls.length, `${slug} tiny moving should have many calls`).toBeGreaterThan(40);
      assertInGrid(resting, cols, rows);
      assertInGrid(moving, cols, rows);

      // Fill area is quantized to 1 px at this size but must still be >5 px² for every
      // product except clusterbid's intentional wireframe resting state.
      if (slug !== 'clusterbid') {
        expect(totalFillArea(resting), `${slug} tiny resting fill area`).toBeGreaterThan(5);
      }
      expect(totalFillArea(moving), `${slug} tiny moving fill area`).toBeGreaterThan(5);

      // Wireframe alone is not enough: each silhouette must emit several stroked rects
      // and the combined stroke+fill count must stay substantial.
      const strokesRest = resting.calls.filter(({ fn }) => fn === 'strokeRect').length;
      const strokesMove = moving.calls.filter(({ fn }) => fn === 'strokeRect').length;
      expect(strokesRest, `${slug} tiny resting strokeRects`).toBeGreaterThan(4);
      expect(strokesMove, `${slug} tiny moving strokeRects`).toBeGreaterThan(4);
    }
  });

  it('clusterbid resting is wireframe but moving is filled, even at tiny', () => {
    const cols = 24;
    const rows = 12;
    const resting = render(clusterbid, cols, rows, seedFrom('clusterbid'), 0);
    const moving = render(clusterbid, cols, rows, seedFrom('clusterbid'), 3.17);
    expect(resting.calls.filter(({ fn }) => fn === 'fillRect').length, 'resting should be wireframe').toBe(0);
    expect(moving.calls.filter(({ fn }) => fn === 'fillRect').length, 'moving should have pod fills').toBeGreaterThan(4);
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
    expect(midEncodes.length, 'expected 3 embedding bars to be filled during encode').toBeGreaterThan(0);
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

    // Answer bars: the moving frame should have more / larger fills than resting
    const answerFillsRest = resting.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && typeof args[0] === 'number' && args[0] > cols * 0.68,
    ).length;
    const answerFillsMoving = assembling.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && typeof args[0] === 'number' && args[0] > cols * 0.68,
    ).length;
    expect(answerFillsMoving, 'answer assembly should add fills').toBeGreaterThan(answerFillsRest);

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
    const arrivalsMid = mid.calls.filter(({ fn, args }) => fn === 'fillRect' && args[2] === packetW && args[3] === packetH);
    const arrivalsLate = late.calls.filter(({ fn, args }) => fn === 'fillRect' && args[2] === packetW && args[3] === packetH);

    expect(arrivalsRest).toHaveLength(0);
    expect(arrivalsLate).toHaveLength(0);
    expect(arrivalsMid.length, 'expected one arrival packet in flight at t=2.3').toBeGreaterThanOrEqual(1);

    // The packet must sit between the bubble row and the parser
    const parserX = cols * 0.405;
    const chatW = cols * 0.275;
    for (const p of arrivalsMid) {
      const x = p.args[0] as number;
      expect(x).toBeGreaterThan(chatW);
      expect(x).toBeLessThan(parserX);
    }
  });

  it('fills ledger rows progressively, never regressing', () => {
    const t0 = render(neev, cols, rows, seed, 0);
    const tMid = render(neev, cols, rows, seed, 1.35); // cycle 0.324
    const tLate = render(neev, cols, rows, seed, 3.17); // cycle 0.761 heavily filled
    const fills0 = t0.calls.filter(({ fn }) => fn === 'fillRect').length;
    const fillsMid = tMid.calls.filter(({ fn }) => fn === 'fillRect').length;
    const fillsLate = tLate.calls.filter(({ fn }) => fn === 'fillRect').length;
    expect(fillsMid).toBeGreaterThan(fills0);
    expect(fillsLate).toBeGreaterThan(fillsMid);
    expect(fillsLate).toBeGreaterThan(25);
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
    const expected = rows < 40 ? 4 : 5;
    expect(stamps.length).toBe(expected);
  });

  it('settles rows from intake permutation into ranked order', () => {
    const intake = render(curatMoney, cols, rows, seed, 0);
    const settling = render(curatMoney, cols, rows, seed, 2.5); // cycle 0.5 settle≈0.2
    const settled = render(curatMoney, cols, rows, seed, 4.5); // fully settled
    // Row frames are strokeRect with width gridW*0.93; keep draw order (per-row) to detect per-row moves.
    const frames = (stub: StubContext) =>
      stub.calls
        .filter(({ fn, args }) => fn === 'strokeRect' && typeof args[2] === 'number' && Math.abs(args[2] - cols * 0.59 * 0.93) < 1)
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
    const feederBox = Math.max(1, rows * 0.075);
    const feedSize = feederBox * 0.56;
    const feedBefore = before.calls.filter(({ fn, args }) => fn === 'fillRect' && args[2] === feedSize && args[3] === feedSize);
    const feedEarly = early.calls.filter(({ fn, args }) => fn === 'fillRect' && args[2] === feedSize && args[3] === feedSize);
    const feedSettled = settled.calls.filter(({ fn, args }) => fn === 'fillRect' && args[2] === feedSize && args[3] === feedSize);
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
    const a = render(bluehostAgents, cols, rows, seed, 1.0);
    const b = render(bluehostAgents, cols, rows, seed, 2.0);
    expect(a.signature()).not.toBe(b.signature());
    // At least one outbound packet (fill) and the clock-driven positions must differ
    const packetsA = a.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === marker && args[3] === marker && typeof args[0] === 'number',
    );
    const packetsB = b.calls.filter(
      ({ fn, args }) => fn === 'fillRect' && args[2] === marker && args[3] === marker && typeof args[0] === 'number',
    );
    expect(packetsA.length).toBeGreaterThan(0);
    expect(packetsB.length).toBeGreaterThan(0);
    // Positions should not be identical across a 1 s gap; at least one packet moves
    const posA = packetsA.map((c) => `${(c.args[0] as number).toFixed(2)},${(c.args[1] as number).toFixed(2)}`).sort().join('|');
    const posB = packetsB.map((c) => `${(c.args[0] as number).toFixed(2)},${(c.args[1] as number).toFixed(2)}`).sort().join('|');
    expect(posB).not.toBe(posA);
  });

  it('shows both outbound and returning markers at some point in the cycle', () => {
    let sawOutbound = false;
    let sawReturning = false;
    for (const t of [0, 1.0, 2.0, 3.17]) {
      const stub = render(bluehostAgents, cols, rows, seed, t);
      const outbound = stub.calls.filter(({ fn, args }) => fn === 'fillRect' && args[2] === marker && args[3] === marker);
      const returning = stub.calls.filter(({ fn, args }) => fn === 'strokeRect' && args[2] === marker && args[3] === marker);
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
    expect(late.calls.filter(({ fn }) => fn === 'fillRect').length).toBeGreaterThan(early.calls.filter(({ fn }) => fn === 'fillRect').length);

    // CI checkmarks appear only after complete>0 (phase 0.04-0.12 etc.)
    // At t=0 there should be no checkmark segments (which are stroke calls with short diagonal)
    // The diagonal checkmarks are the only strokes that are not axis-aligned; we proxy via fill count growth.
    expect(late.signature()).not.toBe(resting.signature());
  });

  it('sends a final packet to the UAT boundary without crossing it', () => {
    const without = render(clusterbid, cols, rows, seed, 0);
    const withPacket = render(clusterbid, cols, rows, seed, 3.17);
    const marker = Math.max(1, rows * 0.043);
    const packetsWithout = without.calls.filter(({ fn, args }) => fn === 'fillRect' && args[2] === marker && args[3] === marker);
    const packetsWith = withPacket.calls.filter(({ fn, args }) => fn === 'fillRect' && args[2] === marker && args[3] === marker);
    // At t=0 only ticks exist, not the travelling final packet at y ≈ podY+podH+gapY*0.5
    // At t=3.17 there is at least one more marker (the final packet) beyond the per-pod ticks.
    expect(packetsWith.length).toBeGreaterThan(packetsWithout.length);

    const uatLeft = Math.max(
      ...withPacket.calls.filter(({ fn }) => fn === 'strokeRect').map(({ args }) => args[0] as number),
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
