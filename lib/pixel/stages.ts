/**
 * Process stages — the four-step pipeline diagram and the separate, simpler
 * icon vocabulary used by its tiles.
 *
 * The band needs enough detail to read as a system: records, decisions,
 * modules, gates, and a conduit joining them. A tile has a different job. It
 * needs one large mark that identifies the step at a glance. Keeping those two
 * vocabularies separate prevents the section from repeating the same picture
 * five times.
 *
 * Every glyph draws into a unit box — (0,0) to (1,1) — and its source maps it
 * into the field.
 */
import { h } from '../pixel';
import type { FieldSource, SourceContext } from './field';

export type StageKind = 'read' | 'spec' | 'build' | 'harden';

export const STAGE_ORDER: readonly StageKind[] = ['read', 'spec', 'build', 'harden'];

/** A glyph draws inside a unit box; the caller supplies the transform. */
type UnitGlyph = (o: CanvasRenderingContext2D, s: number) => void;

/**
 * Read — the record, twice. Two offset sheets of ruled lines, the front one
 * with a scan bar across it. Lines are ragged like real text, not a comb.
 */
const readGlyph: UnitGlyph = (o, s) => {
  const lw = s * 0.028;
  o.lineWidth = lw;

  // The sheet behind, offset up and right.
  o.strokeRect(s * 0.28, s * 0.12, s * 0.56, s * 0.68);
  // The sheet in front.
  o.fillRect(s * 0.16, s * 0.22, s * 0.56, s * 0.7);
  o.save();
  o.globalCompositeOperation = 'destination-out';
  o.fillRect(s * 0.16 + lw, s * 0.22 + lw, s * 0.56 - lw * 2, s * 0.7 - lw * 2);
  o.restore();

  // Ruled text, ragged right.
  const widths = [0.42, 0.36, 0.44, 0.3, 0.4, 0.24];
  widths.forEach((w, i) => {
    o.fillRect(s * 0.23, s * (0.32 + i * 0.095), s * w, s * 0.032);
  });
  // The second pass: a scan bar sitting over the text.
  o.fillRect(s * 0.11, s * 0.53, s * 0.66, s * 0.055);
};

/**
 * Spec — a decision, written down. A framed sheet with a heavy title bar, then
 * a branch below it: one path taken, one path left. An ADR is exactly that.
 */
const specGlyph: UnitGlyph = (o, s) => {
  const lw = s * 0.028;
  o.lineWidth = lw;
  o.strokeRect(s * 0.14, s * 0.1, s * 0.72, s * 0.44);
  o.fillRect(s * 0.14, s * 0.1, s * 0.72, s * 0.1);
  o.fillRect(s * 0.2, s * 0.28, s * 0.44, s * 0.035);
  o.fillRect(s * 0.2, s * 0.37, s * 0.32, s * 0.035);

  // The branch: a stem that forks, one arm ending in a filled node (chosen),
  // the other in a hollow one (rejected, kept on the record).
  o.beginPath();
  o.moveTo(s * 0.5, s * 0.54);
  o.lineTo(s * 0.5, s * 0.66);
  o.stroke();
  o.beginPath();
  o.moveTo(s * 0.28, s * 0.66);
  o.lineTo(s * 0.72, s * 0.66);
  o.stroke();
  for (const x of [0.28, 0.72]) {
    o.beginPath();
    o.moveTo(s * x, s * 0.66);
    o.lineTo(s * x, s * 0.76);
    o.stroke();
  }
  o.beginPath();
  o.arc(s * 0.28, s * 0.83, s * 0.066, 0, 7);
  o.fill();
  o.lineWidth = lw * 1.2;
  o.beginPath();
  o.arc(s * 0.72, s * 0.83, s * 0.066, 0, 7);
  o.stroke();
};

/**
 * Build — modules landing. A base course of blocks, a second course above it,
 * and one block still in the air with a drop line, so it reads as assembly in
 * progress rather than a finished wall.
 */
const buildGlyph: UnitGlyph = (o, s) => {
  const lw = s * 0.028;
  const bw = s * 0.2;
  const bh = s * 0.15;

  for (let i = 0; i < 3; i++) o.fillRect(s * 0.16 + i * (bw + s * 0.04), s * 0.74, bw, bh);
  for (let i = 0; i < 2; i++) o.fillRect(s * 0.28 + i * (bw + s * 0.04), s * 0.55, bw, bh);

  // The block in flight, with its drop line.
  o.lineWidth = lw;
  o.beginPath();
  o.moveTo(s * 0.5, s * 0.1);
  o.lineTo(s * 0.5, s * 0.32);
  o.stroke();
  o.fillRect(s * 0.4, s * 0.32, bw, bh);
};

/**
 * Harden — the gate. Two posts and a barrier, a tick where the barrier meets
 * the right post, and a trace below running under a threshold line. This is the
 * process gate and the receipt, which is what hardening means here.
 */
const hardenGlyph: UnitGlyph = (o, s) => {
  const lw = s * 0.028;
  o.lineWidth = lw;

  o.fillRect(s * 0.14, s * 0.16, s * 0.06, s * 0.5);
  o.fillRect(s * 0.8, s * 0.16, s * 0.06, s * 0.5);
  o.fillRect(s * 0.14, s * 0.24, s * 0.72, s * 0.06);

  // The tick.
  o.lineWidth = lw * 1.6;
  o.lineCap = 'butt';
  o.beginPath();
  o.moveTo(s * 0.56, s * 0.44);
  o.lineTo(s * 0.64, s * 0.53);
  o.lineTo(s * 0.82, s * 0.34);
  o.stroke();

  // Threshold, then a trace that stays under it.
  o.lineWidth = lw * 0.8;
  o.beginPath();
  o.moveTo(s * 0.1, s * 0.78);
  o.lineTo(s * 0.9, s * 0.78);
  o.stroke();
  o.lineWidth = lw * 1.3;
  o.beginPath();
  const pts = [0.9, 0.86, 0.93, 0.84, 0.88, 0.91, 0.85, 0.89];
  pts.forEach((y, i) => {
    const x = s * (0.1 + (i / (pts.length - 1)) * 0.8);
    if (i === 0) o.moveTo(x, s * y);
    else o.lineTo(x, s * y);
  });
  o.stroke();
};

const GLYPHS: Record<StageKind, UnitGlyph> = {
  read: readGlyph,
  spec: specGlyph,
  build: buildGlyph,
  harden: hardenGlyph,
};

/**
 * Tile icons deliberately avoid the band's document / branch / wall / gate
 * drawings. They are single-sign vocabulary: inspect, decide, rise, secure.
 */
const readTileGlyph: UnitGlyph = (o, s) => {
  o.lineWidth = Math.min(1, s * 0.048);
  o.beginPath();
  o.arc(s * 0.43, s * 0.42, s * 0.23, 0, Math.PI * 2);
  o.stroke();
  o.beginPath();
  o.moveTo(s * 0.59, s * 0.59);
  o.lineTo(s * 0.79, s * 0.79);
  o.stroke();
};

const specTileGlyph: UnitGlyph = (o, s) => {
  o.lineWidth = Math.min(1, s * 0.048);
  o.beginPath();
  o.moveTo(s * 0.5, s * 0.14);
  o.lineTo(s * 0.84, s * 0.5);
  o.lineTo(s * 0.5, s * 0.86);
  o.lineTo(s * 0.16, s * 0.5);
  o.closePath();
  o.stroke();
  o.beginPath();
  o.arc(s * 0.5, s * 0.5, s * 0.06, 0, Math.PI * 2);
  o.fill();
};

const buildTileGlyph: UnitGlyph = (o, s) => {
  o.lineWidth = Math.min(1, s * 0.04);
  o.lineJoin = 'miter';
  o.beginPath();
  o.moveTo(s * 0.18, s * 0.78);
  o.lineTo(s * 0.39, s * 0.78);
  o.lineTo(s * 0.39, s * 0.58);
  o.lineTo(s * 0.6, s * 0.58);
  o.lineTo(s * 0.6, s * 0.38);
  o.lineTo(s * 0.81, s * 0.38);
  o.stroke();
  o.beginPath();
  o.moveTo(s * 0.68, s * 0.25);
  o.lineTo(s * 0.81, s * 0.38);
  o.lineTo(s * 0.68, s * 0.51);
  o.stroke();
};

const hardenTileGlyph: UnitGlyph = (o, s) => {
  o.lineWidth = Math.min(1, s * 0.032);
  o.beginPath();
  o.arc(s * 0.5, s * 0.39, s * 0.2, Math.PI, 0);
  o.stroke();
  o.strokeRect(s * 0.25, s * 0.39, s * 0.5, s * 0.4);
};

const TILE_GLYPHS: Record<StageKind, UnitGlyph> = {
  read: readTileGlyph,
  spec: specTileGlyph,
  build: buildTileGlyph,
  harden: hardenTileGlyph,
};

const FULL_TURN = Math.PI * 2;

/**
 * A sampled disc: one round edge plus a deterministic, low-density interior.
 * The stipple keeps it spherical on the cell grid without turning any 8×8
 * window into a slab.
 */
function drawTileBloom(
  o: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  progress: number,
  seed: number,
): void {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return;

  const size = Math.min(cols, rows);
  const cx = cols * 0.5;
  const cy = rows * 0.5;
  const radius = size * 0.42 * p;
  const lineWidth = 0.65;

  o.save();
  o.shadowBlur = 0;
  o.lineWidth = lineWidth;
  o.beginPath();
  const segmentCount = radius < 8 ? 2 : 4;
  for (let segment = 0; segment < segmentCount; segment++) {
    const angle = ((segment + 0.5) / segmentCount) * FULL_TURN;
    o.arc(cx, cy, radius, angle - 0.15, angle + 0.15);
  }
  o.stroke();

  const innerRadius = Math.max(0, radius - lineWidth * 1.5);
  const innerSquared = innerRadius * innerRadius;
  const startX = Math.max(0, Math.floor(cx - innerRadius));
  const endX = Math.min(cols, Math.ceil(cx + innerRadius));
  const startY = Math.max(0, Math.floor(cy - innerRadius));
  const endY = Math.min(rows, Math.ceil(cy + innerRadius));

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= innerSquared) continue;

      const centreWeight = 1 - Math.sqrt(distanceSquared) / Math.max(1, innerRadius);
      if (h(x + seed * 1.7, y - seed * 2.3) >= 0.02 + centreWeight * 0.025) continue;
      o.fillRect(x, y, 0.8, 0.8);
    }
  }
  o.restore();
}

/** One simple icon, centred and fitted to the authoring tile grid. */
export function tileStage(kind: StageKind): FieldSource {
  return (o, { cols, rows, progress = 0, seed }) => {
    drawTileBloom(o, cols, rows, progress, seed);

    const s = Math.min(cols, rows) * 0.88;
    o.save();
    o.shadowBlur = 0;
    o.translate((cols - s) / 2, (rows - s) / 2);
    TILE_GLYPHS[kind](o, s);
    o.restore();
  };
}

/** One detailed band glyph, centred and fitted to a standalone field. */
export function stage(kind: StageKind): FieldSource {
  return (o, { cols, rows }) => {
    const s = Math.min(cols, rows) * 0.95;
    o.save();
    o.translate((cols - s) / 2, (rows - s) / 2);
    GLYPHS[kind](o, s);
    o.restore();
  };
}

/**
 * The whole pipeline, end to end: four glyphs across the width joined by a
 * conduit, with a travelling packet on it. `active` swells one stage and
 * thins the rest, which is how a hovered column reads as selected.
 *
 * The conduit is drawn first so the glyphs sit over it.
 */
export function pipeline(
  kinds: readonly StageKind[] = STAGE_ORDER,
  active: number | null = null,
): FieldSource {
  return (o, { cols, rows, t }: SourceContext) => {
    const n = kinds.length;
    const slot = cols / n;
    const midY = rows * 0.5;
    const glyphSize = Math.min(slot * 0.6, rows * 0.74);

    // Conduit.
    o.lineWidth = Math.max(1, rows * 0.03);
    o.beginPath();
    o.moveTo(slot * 0.5, midY);
    o.lineTo(cols - slot * 0.5, midY);
    o.stroke();

    // Packets travelling the conduit, phase-offset so the line always has flow.
    const span = cols - slot;
    for (let k = 0; k < 3; k++) {
      const p = ((t * 0.9 + k / 3) % 1) * span;
      o.fillRect(slot * 0.5 + p, midY - rows * 0.045, rows * 0.06, rows * 0.09);
    }

    kinds.forEach((kind, i) => {
      const cx = slot * (i + 0.5);
      const emphasis = active === null ? 1 : active === i ? 1.12 : 0.55;
      const s = glyphSize * emphasis;
      o.save();
      o.globalAlpha = active === null || active === i ? 1 : 0.5;
      o.translate(cx - s / 2, midY - s / 2);
      GLYPHS[kind](o, s);
      o.restore();
    });
  };
}
