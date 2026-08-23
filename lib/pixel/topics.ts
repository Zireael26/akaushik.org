/**
 * Per-topic art for the writing routes.
 *
 * Every writing post declares one member of a small closed vocabulary in its
 * frontmatter (`art: retrieval`), and each member maps to a FieldSource here.
 * The vocabulary is closed on purpose — a typo in frontmatter is caught by
 * `scripts/build-content-bundle.ts` at build time, and an absent `art:` falls
 * back to the trellis field visibly (the generator warns) rather than silently.
 *
 * Like every source in this library, these are drawing functions, not bitmaps:
 * greyscale into an offscreen 2D context, composed in normalised space off
 * `cols`/`rows` so the same source reads at `hero`, `band`, `card` and `strip`
 * sizes. No hex, no `window`, no `document` — colour belongs to the engine.
 *
 * Posts sharing a topic share a composition, never a texture: the field's
 * per-instance hash (seeded by `seedFrom(slug)`) varies the noise, and the
 * sources below additionally key their structural jitter off `c.seed`, so two
 * posts on the same subject still do not render identically.
 *
 * Animation is deliberately spartan. These strips sit below the fold on a
 * detail page; each source does one slow, legible thing per cycle — a sweep, a
 * fill, an arrival — at a fraction of `neuralTraining`'s per-frame cost, and
 * every one of them composes a complete frame at `t = 0` so reduced-motion
 * visitors see the finished thought, not a blank awaiting a clock.
 */
import { h } from '../pixel';
import type { FieldSource, SourceContext } from './field';

/** The closed topic vocabulary. One entry per genuine cluster in `content/writing/`. */
export type WritingArt =
  | 'agent-process'
  | 'retrieval'
  | 'ml-foundations'
  | 'field-work'
  | 'site-craft'
  | 'operations';

export const WRITING_ART_TOPICS = [
  'agent-process',
  'retrieval',
  'ml-foundations',
  'field-work',
  'site-craft',
  'operations',
] as const satisfies readonly WritingArt[];
/**
 * Seeded unit jitter in 0..1. Every structural decision a source makes — which
 * cell starts hollow, where a dot lands — comes from here keyed by the field's
 * seed, so the same slug redraws identically forever and different slugs of
 * the same topic diverge beyond the engine's noise alone.
 */
function jit(seed: number, i: number, k: number): number {
  return h(seed * 1.37 + i * 12.9898, k * 78.233 + seed * 0.913);
}

/* ------------------------------------------------------------------ *
 * agent-process — trellis, rc, loop-era, playbook, gptx, profiles, hooks
 *
 * An enforcement matrix: a gate feeding a conduit into a grid of cells where
 * a few sit hollow — the drift between "a rule exists" and "a rule fires".
 * A sweep crosses once per cycle and closes every hollow cell it passes,
 * then the cycle wraps and the audit starts over. Ticks accrue on a rail
 * below: the receipts.
 * ------------------------------------------------------------------ */
const PROCESS_RATE = 0.26; // one sweep ≈ 11s at the field's 0.006/frame clock

const agentProcessArt: FieldSource = (o, { cols, rows, t, seed }) => {
  const cycle = (t * PROCESS_RATE) % 1;
  const NC = 9;
  const NR = 3;
  const left = cols * 0.2;
  const right = cols * 0.94;
  const colW = (right - left) / NC;
  const s = Math.min(colW * 0.58, rows * 0.17);
  const cy = rows * 0.42;
  const top = cy - ((NR - 1) * s) / 2;

  // The gate: one post, and a barrier held clear of the conduit.
  o.globalAlpha = 0.72;
  o.lineWidth = Math.max(1, rows * 0.045);
  o.beginPath();
  o.moveTo(cols * 0.06, cy - s * 1.6);
  o.lineTo(cols * 0.06, cy + s * 1.6);
  o.stroke();
  o.beginPath();
  o.moveTo(cols * 0.06, cy - s * 0.95);
  o.lineTo(cols * 0.125, cy - s * 0.95);
  o.stroke();

  // Conduit from the gate into the matrix.
  o.globalAlpha = 0.56;
  o.lineWidth = Math.max(1, rows * 0.03);
  o.beginPath();
  o.moveTo(cols * 0.06, cy);
  o.lineTo(left - s * 0.4, cy);
  o.stroke();

  // The sweep: gate to far edge over the first 85% of the cycle, then hold.
  const sweepP = Math.min(1, cycle / 0.85);
  const px =
    cols * 0.06 +
    (right + s - cols * 0.06) * (sweepP * sweepP * (3 - 2 * sweepP));
  const packet = Math.max(1.5, Math.min(s * 0.18, rows * 0.06));
  const packetX = Math.min(right - packet / 2, Math.max(cols * 0.06 + packet / 2, px));

  // The matrix stays traced. A swept hollow cell earns only a small closure
  // mark, so the audit reads as ink on a grid rather than a filled barcode.
  o.lineWidth = Math.max(0.75, rows * 0.018);
  for (let r = 0; r < NR; r++) {
    for (let i = 0; i < NC; i++) {
      const x = left + i * colW + (colW - s) / 2;
      const y = top + r * s;
      const hollow = jit(seed, i, r) < 0.3;
      o.globalAlpha = hollow ? 0.36 : 0.6;
      o.strokeRect(x, y, s, s);
      if (!hollow || px < x + s) continue;

      const mark = Math.max(1, s * 0.14);
      o.globalAlpha = 0.78;
      o.fillRect(x + (s - mark) / 2, y + (s - mark) / 2, mark, mark);
    }
  }

  // A single packet makes the current pass legible without turning the rail
  // into another solid bar.
  o.globalAlpha = 0.78;
  o.fillRect(packetX - packet / 2, cy - packet / 2, packet, packet);

  // Receipts: one small tick per column the sweep has cleared.
  const railY = rows * 0.86;
  const tick = Math.max(1.5, rows * 0.035);
  o.globalAlpha = 0.64;
  for (let i = 0; i < NC; i++) {
    if (px < left + i * colW + s) continue;
    o.fillRect(left + i * colW + (colW - tick) / 2, railY, tick, tick);
  }
  o.globalAlpha = 1;
};

/* ------------------------------------------------------------------ *
 * retrieval — fastembed-to-tei
 *
 * Query, store, cited answer. The query bar pulses while the retrieval is in
 * flight; a rotating pair of store rows lights as the nearest neighbours; a
 * link runs from each of them into the answer block, whose lines assemble
 * behind its quote marks as the cycle proceeds. The citation is the point.
 * ------------------------------------------------------------------ */
const RETRIEVAL_RATE = 0.3; // ≈ 9s per query

const retrievalArt: FieldSource = (o, { cols, rows, t, seed }) => {
  const cycle = (t * RETRIEVAL_RATE) % 1;
  const epoch = Math.floor(t * RETRIEVAL_RATE);

  // Query register, with one small packet pulsing through the outlined slot.
  const qh = rows * 0.4;
  const qx = cols * 0.07;
  const qy = rows * 0.5 - qh / 2;
  const qw = cols * 0.055;
  o.globalAlpha = 0.3 + 0.24 * Math.abs(Math.sin(t * 1.7));
  o.lineWidth = Math.max(0.75, rows * 0.018);
  o.strokeRect(qx, qy, qw, qh);
  const queryPacket = Math.max(1, Math.min(qw * 0.42, rows * 0.055));
  o.globalAlpha = 0.72;
  o.fillRect(
    qx + (qw - queryPacket) / 2,
    qy + (qh - queryPacket) * jit(seed, epoch, 6),
    queryPacket,
    queryPacket,
  );

  // The store is a lightly ruled index rather than a field of solid chunks.
  const SN = 12;
  const SR = 4;
  const sx = cols * 0.24;
  const ex = cols * 0.68;
  const colW = (ex - sx) / SN;
  const rowH = (rows * 0.52) / SR;
  const sy = rows * 0.24;
  const lit0 = Math.floor(jit(seed, epoch, 1) * SR);
  const lit1 = (lit0 + 1 + Math.floor(jit(seed, epoch, 2) * (SR - 1))) % SR;

  o.globalAlpha = 0.38;
  o.lineWidth = Math.max(0.75, rows * 0.016);
  o.strokeRect(sx, sy, ex - sx, rowH * SR);
  for (let r = 0; r < SR; r++) {
    const lit = r === lit0 || r === lit1;
    const y = sy + (r + 0.5) * rowH;
    o.globalAlpha = lit ? 0.62 : 0.2;
    o.beginPath();
    o.moveTo(sx, y);
    o.lineTo(ex, y);
    o.stroke();

    const tickH = Math.max(1, Math.min(1.5, rowH * 0.2));
    o.beginPath();
    for (let i = 0; i < SN; i++) {
      const x = sx + (i + 0.5) * colW;
      o.moveTo(x, y - tickH / 2);
      o.lineTo(x, y + tickH / 2);
    }
    o.stroke();

    if (!lit) continue;
    const node = Math.max(1, Math.min(rowH * 0.38, colW * 0.18));
    const selected = Math.floor(jit(seed, epoch + r, 4) * SN);
    o.globalAlpha = 0.74;
    o.fillRect(sx + (selected + 0.5) * colW - node / 2, y - node / 2, node, node);
  }

  // Links from the lit rows converge on the answer.
  const ax = cols * 0.76;
  const aw = cols * 0.17;
  o.lineWidth = Math.max(0.75, rows * 0.02);
  o.globalAlpha = 0.42;
  for (const r of [lit0, lit1]) {
    o.beginPath();
    o.moveTo(ex, sy + r * rowH + rowH / 2);
    o.lineTo(ax, rows * 0.33);
    o.stroke();
  }

  // The answer is framed and ruled; quote marks and lines arrive in ink.
  o.globalAlpha = 0.56;
  o.lineWidth = Math.max(0.75, rows * 0.018);
  o.strokeRect(ax, rows * 0.2, aw, rows * 0.56);
  for (const qx of [ax + aw * 0.06, ax + aw * 0.16]) {
    o.beginPath();
    o.moveTo(qx + aw * 0.035, rows * 0.2);
    o.lineTo(qx, rows * 0.245);
    o.lineTo(qx + aw * 0.035, rows * 0.29);
    o.stroke();
  }
  for (let l = 0; l < 3; l++) {
    // The lead line is always there; the rest arrive as the cycle runs.
    if (l > 0 && cycle <= 0.3 + l * 0.18) continue;
    const w = l === 2 ? 0.55 : 0.95;
    o.globalAlpha = 0.52;
    o.beginPath();
    o.moveTo(ax + aw * 0.06, rows * (0.38 + l * 0.12));
    o.lineTo(ax + aw * (0.06 + w * 0.84), rows * (0.38 + l * 0.12));
    o.stroke();
  }
  o.globalAlpha = 1;
};

/* ------------------------------------------------------------------ *
 * ml-foundations — micrograd-makemore
 *
 * Re-implementing the thing to understand the thing: a descending staircase
 * of unit squares, laid one at a time against a ruled foundation line — the
 * gradient descending step by step onto measured ground. The staircase runs
 * with the width of the frame (columns derive from `cols`, unit height from
 * `rows`), so it fills any aspect instead of shrinking to a pyramid in the
 * middle of a wide strip. When every block has landed the structure holds,
 * then wraps and starts again.
 * ------------------------------------------------------------------ */
const FOUNDATIONS_RATE = 0.18; // cycles per t-unit; a full build ≈ 8s

const foundationsArt: FieldSource = (o, { cols, rows, t, seed }) => {
  const u = Math.max(2, rows * 0.16);
  // Columns come from the width, column height from the depth budget —
  // together they keep the staircase filling the frame at any aspect.
  const steps = Math.max(3, Math.floor((cols * 0.84) / u));
  const peak = Math.max(3, Math.floor((rows * 0.68) / u));
  const heights = Array.from(
    { length: steps },
    (_, i) => Math.max(1, Math.round(peak * (1 - i / steps))),
  );
  const total = heights.reduce((sum, n) => sum + n, 0);

  // The build runs over the first 55% of the cycle, then holds the finished
  // staircase before wrapping. Phase-offset so a frozen first frame already
  // shows construction under way.
  const progress = (t * FOUNDATIONS_RATE + 0.08) % 1;
  const laid = Math.floor((Math.min(progress, 0.55) / 0.55) * total);

  const baseY = rows * 0.82;
  const leftX = (cols - steps * u) / 2;
  const marker = Math.max(1, Math.min(u * 0.16, rows * 0.045));
  o.lineWidth = Math.max(0.75, rows * 0.018);
  let count = 0;
  for (let i = 0; i < steps && count < laid; i++) {
    for (let j = 0; j < heights[i]! && count < laid; j++) {
      const g = (jit(seed, i, j) - 0.5) * Math.min(1, u * 0.16);
      const x = leftX + i * u + 0.5 + g;
      const y = baseY - (j + 1) * u + 0.5 + g;
      o.globalAlpha = 0.4 + jit(seed, i, j + 13) * 0.2;
      o.strokeRect(x, y, u - 1, u - 1);
      if (count === laid - 1) {
        o.globalAlpha = 0.78;
        o.fillRect(x + (u - marker) / 2, y + (u - marker) / 2, marker, marker);
      }
      count++;
    }
  }
  o.globalAlpha = 0.68;

  // The foundation: a heavier base line under the staircase.
  o.lineWidth = Math.max(1, rows * 0.04);
  o.beginPath();
  o.moveTo(leftX - u * 0.5, baseY);
  o.lineTo(leftX + steps * u + u * 0.5, baseY);
  o.stroke();
  o.globalAlpha = 1;
};

/* ------------------------------------------------------------------ *
 * field-work — ai-for-msme
 *
 * Messages arrive off the clock — dots landing at seeded, irregular spacings
 * along a lane — and each arrival drops a line into the ledger spread below,
 * ticking the next row. The work of field ops: whatever comes in, written
 * down, in order, one row at a time.
 * ------------------------------------------------------------------ */
const FIELDWORK_RATE = 0.24; // ≈ 11.5s per day of arrivals

const fieldWorkArt: FieldSource = (o, { cols, rows, t, seed }) => {
  const ARRIVALS = 6;
  // Phase-offset so a frozen first frame already shows work recorded.
  const cycle = (t * FIELDWORK_RATE + 0.12) % 1;
  const slots = Array.from({ length: ARRIVALS }, (_, k) => (k + jit(seed, k, 9) * 0.7) / ARRIVALS);
  const order = slots
    .map((slot, k) => [slot, k] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, k]) => k);
  const rowOf = (k: number): number => order.indexOf(k);

  // The ledger: a two-page spread with gutter, margin rule and six ruled rows.
  const lx = cols * 0.24;
  const rx = cols * 0.8;
  const ty = rows * 0.36;
  const by = rows * 0.88;
  o.globalAlpha = 0.56;
  o.lineWidth = Math.max(1, rows * 0.03);
  o.strokeRect(lx, ty, rx - lx, by - ty);
  o.lineWidth = 1;
  o.beginPath();
  o.moveTo((lx + rx) / 2, ty);
  o.lineTo((lx + rx) / 2, by);
  o.stroke();
  o.beginPath();
  o.moveTo(lx + (rx - lx) * 0.14, ty);
  o.lineTo(lx + (rx - lx) * 0.14, by);
  o.stroke();
  const rowH = (by - ty) / 6;
  o.lineWidth = Math.max(0.75, rows * 0.015);
  for (let r = 1; r < 6; r++) {
    const y = ty + r * rowH;
    o.beginPath();
    o.moveTo(lx, y);
    o.lineTo(rx, y);
    o.stroke();
  }

  // The lane above, and its irregular arrivals.
  const laneY = rows * 0.2;
  const d = Math.max(1.5, rows * 0.05);
  for (let k = 0; k < ARRIVALS; k++) {
    const x = lx + (rx - lx) * ((k + 0.5) / ARRIVALS) + (jit(seed, k, 3) - 0.5) * cols * 0.02;
    const arrived = cycle >= (slots[k] ?? 1);
    o.globalAlpha = arrived ? 0.4 : 0.72;
    o.fillRect(x - d / 2, laneY - d / 2, d, d);
    if (!arrived) continue;
    const rowIdx = rowOf(k);
    const rowTop = ty + rowIdx * rowH;
    o.globalAlpha = 0.5;
    o.lineWidth = Math.max(0.75, rows * 0.016);
    o.beginPath();
    o.moveTo(x, laneY + d / 2);
    o.lineTo(x, rowTop + rowH * 0.55);
    o.stroke();
    // The entry is a ruled trace across its row, not a solid status bar.
    o.globalAlpha = 0.58;
    o.lineWidth = Math.max(0.75, rowH * 0.08);
    o.beginPath();
    o.moveTo(lx + (rx - lx) * 0.18, rowTop + rowH * 0.5);
    o.lineTo(lx + (rx - lx) * 0.48, rowTop + rowH * 0.5);
    o.stroke();
  }
  o.globalAlpha = 1;
};

/* ------------------------------------------------------------------ *
 * site-craft — building-this-portfolio
 *
 * The page builds itself in ship order: frame first, then header, hero,
 * column, column, footer — each region is traced in as its turn comes, with a
 * commit dot accruing beneath the frame for every region shipped. Each build
 * leaves exactly one region as an outlined slot — the thing that build did not
 * finish — rotating through the regions as the builds advance, so the artefact
 * is visibly always under construction.
 * ------------------------------------------------------------------ */
const SITECRAFT_RATE = 0.3; // ≈ 9s per build
// Region layout in frame fractions: header, hero, column one, column two,
// footer — ship order, top to bottom.
const SITE_REGIONS: Array<[number, number, number, number]> = [
  [0.04, 0.06, 0.92, 0.11],
  [0.05, 0.22, 0.52, 0.44],
  [0.62, 0.22, 0.33, 0.19],
  [0.62, 0.47, 0.33, 0.19],
  [0.04, 0.83, 0.92, 0.11],
];
// Five regions plus a two-cycle hold of the finished page.
const SITE_PERIOD = SITE_REGIONS.length + 2;
const siteCraftArt: FieldSource = (o, { cols, rows, t, seed }) => {
  const clock = t * SITECRAFT_RATE + 0.25;
  const cycle = clock % 1;
  const build = Math.max(0, Math.floor(clock));
  const deferred = (i: number): boolean => i === build % SITE_REGIONS.length;
  const done = Math.floor(cycle * SITE_PERIOD);

  const fx = cols * 0.2;
  const fw = cols * 0.6;
  const fy = rows * 0.14;
  const fh = rows * 0.68;

  // The frame is always there; completed regions become light, ruled traces.
  o.globalAlpha = 0.62;
  o.lineWidth = Math.max(1, rows * 0.035);
  o.strokeRect(fx, fy, fw, fh);
  o.globalAlpha = 0.38;
  o.lineWidth = Math.max(0.75, rows * 0.016);
  const frameTickX = fx + fw * (0.12 + jit(seed, build, 14) * 0.76);
  o.beginPath();
  o.moveTo(frameTickX, fy);
  o.lineTo(frameTickX, fy + Math.max(1, fh * 0.06));
  o.stroke();

  // Regions arrive in ship order. The deferred slot remains a plain outline;
  // completed regions gain a few short rules instead of a solid panel.
  SITE_REGIONS.forEach(([rx, ry, rw, rh], i) => {
    const x = fx + rx * fw;
    const y = fy + ry * fh;
    const w = rw * fw;
    const hgt = rh * fh;
    if (!deferred(i)) {
      if (i >= done) return;

      o.globalAlpha = 0.58;
      o.lineWidth = Math.max(0.75, rows * 0.018);
      o.strokeRect(x, y, w, hgt);
      const rules = hgt > rows * 0.14 ? 2 : 1;
      o.globalAlpha = 0.34;
      o.lineWidth = Math.max(0.75, rows * 0.014);
      for (let rule = 0; rule < rules; rule++) {
        const ruleY = y + hgt * ((rule + 1) / (rules + 1));
        const ruleEnd = x + w * (0.38 + jit(seed, i * 3 + rule, 11) * 0.42);
        o.beginPath();
        o.moveTo(x + Math.min(w * 0.08, 1), ruleY);
        o.lineTo(ruleEnd, ruleY);
        o.stroke();
      }
      return;
    }

    o.globalAlpha = 0.4;
    o.lineWidth = Math.max(0.75, rows * 0.02);
    o.strokeRect(x, y, w, hgt);
  });

  // Commit dots: one small receipt per shipped region.
  const dd = Math.max(1.5, rows * 0.045);
  const dy = fy + fh + rows * 0.07;
  o.globalAlpha = 0.66;
  for (let i = 0; i < SITE_REGIONS.length && i < done; i++) {
    const x =
      fx +
      (fw / (SITE_REGIONS.length + 1)) * (i + 1) +
      (jit(seed, i, 13) - 0.5) * Math.min(dd * 0.45, fw * 0.015);
    o.fillRect(x - dd / 2, dy, dd, dd);
  }
  o.globalAlpha = 1;
};

/* ------------------------------------------------------------------ *
 * operations — detection-is-not-continuity, renaming-projects
 *
 * Live telemetry scrolling under a threshold line. Once per cycle a spike
 * swells out of the noise and drifts left across the detector; each time it
 * passes, a marker drops onto the lane above. Detection, visibly not the
 * same thing as continuity — the trace kept scrolling the whole time.
 * ------------------------------------------------------------------ */
const OPERATIONS_RATE = 0.22; // ≈ 12.5s per incident

const operationsArt: FieldSource = (o, { cols, rows, t, seed }) => {
  const cycle = (t * OPERATIONS_RATE + 0.35) % 1;
  const lx = cols * 0.07;
  const rx = cols * 0.93;

  // Threshold.
  const thY = rows * 0.3;
  o.globalAlpha = 0.56;
  o.lineWidth = Math.max(0.75, rows * 0.02);
  o.beginPath();
  o.moveTo(lx, thY);
  o.lineTo(rx, thY);
  o.stroke();

  // The trace: seeded noise scrolling left, plus one spike per cycle.
  const baseY = rows * 0.68;
  const amp = rows * 0.13;
  const spikeCentre = rx + cols * 0.05 - (rx - lx + cols * 0.2) * cycle;
  const spikeW = cols * 0.07;
  o.globalAlpha = 0.68;
  o.lineWidth = Math.max(1, rows * 0.028);
  o.beginPath();
  const STEPS = 48;
  for (let i = 0; i <= STEPS; i++) {
    const x = lx + ((rx - lx) * i) / STEPS;
    const n = jit(seed, i * 0.37 + cycle * 14, 7) - 0.5;
    const dt = (x - spikeCentre) / spikeW;
    const spike = Math.exp(-dt * dt * 0.5) * rows * 0.56;
    const y = baseY + n * amp - spike;
    if (i === 0) o.moveTo(x, y);
    else o.lineTo(x, y);
  }
  o.stroke();

  // The detector: a faint picket from the marker lane down to the trace.
  const detX = cols * 0.42;
  o.globalAlpha = 0.28;
  o.lineWidth = 1;
  o.beginPath();
  o.moveTo(detX, rows * 0.1);
  o.lineTo(detX, baseY);
  o.stroke();
  // Markers accumulate on the detector each time the spike passes — stacked
  // down the picket, so even an 18-row strip keeps them inside the frame.
  const mw = Math.max(1.5, rows * 0.05);
  const markers = Math.min(3, Math.floor(cycle / 0.34));
  o.globalAlpha = 0.66;
  for (let m = 0; m < markers; m++) {
    o.fillRect(detX - mw / 2, rows * 0.14 + m * mw * 1.9, mw, mw);
  }
  o.globalAlpha = 1;
};

/**
 * The vocabulary's sources, by topic. Indexed access stays inside the union;
 * `topicSource` is the string-typed door for frontmatter values.
 */
export const topicSources: Readonly<Record<WritingArt, FieldSource>> = {
  'agent-process': agentProcessArt,
  retrieval: retrievalArt,
  'ml-foundations': foundationsArt,
  'field-work': fieldWorkArt,
  'site-craft': siteCraftArt,
  operations: operationsArt,
};

/**
 * Resolve a frontmatter `art:` value to its source. Anything unknown or
 * absent — including the empty string an empty `art:` parses to — resolves
 * to null, which callers turn into the trellis fallback. Never throws.
 */
export function topicSource(art: string | null | undefined): FieldSource | null {
  if (!art) return null;
  return (topicSources as Readonly<Record<string, FieldSource | undefined>>)[art] ?? null;
}

/** Narrow a raw frontmatter value to the union, or null when it isn't one. */
export function asWritingArt(value: unknown): WritingArt | null {
  return typeof value === 'string' && (WRITING_ART_TOPICS as readonly string[]).includes(value)
    ? (value as WritingArt)
    : null;
}
