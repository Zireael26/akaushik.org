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
 * drawings. They are single-sign vocabulary: scan, decide, rise, secure.
 */
/**
 * One shared geometry source per icon: `tileStage` strokes it for the resting
 * ink glyph, and `eraseTileGlyph` runs the same Path2D wider to punch the
 * icon out of the snap disc. Two copies would drift; the knockout is exactly
 * the thing that must match the visible stroke.
 */
const readTileGlyph: UnitGlyph = (o, s) => {
  o.lineWidth = Math.min(1, s * 0.048);
  o.lineJoin = 'miter';
  strokeGlyph(o, tileGlyphPath('read', s));
};

const specTileGlyph: UnitGlyph = (o, s) => {
  o.lineWidth = Math.min(1, s * 0.048);
  o.lineJoin = 'miter';
  // The diamond is stroked; the decision dot is filled. Folding both into one
  // shared path made the dot a stroked ring — outer radius 0.084s around a
  // 0.036s hole at this line width — where it had always been a solid mark.
  // The eraser still takes the dot from `tileGlyphPath`, because a knockout
  // wants the ring's full extent, not the fill's.
  strokeGlyph(o, tileGlyphPath('spec', s, { specDot: false }));
  o.beginPath();
  o.arc(s * 0.5, s * 0.5, TILE_SPEC_DOT_R * s, 0, FULL_TURN);
  o.fill();
};

const buildTileGlyph: UnitGlyph = (o, s) => {
  o.lineWidth = Math.min(1, s * 0.04);
  o.lineJoin = 'miter';
  strokeGlyph(o, tileGlyphPath('build', s));
};

const hardenTileGlyph: UnitGlyph = (o, s) => {
  o.lineWidth = Math.min(1, s * 0.032);
  o.lineJoin = 'miter';
  strokeGlyph(o, tileGlyphPath('harden', s));
};

/** The spec tile's centre decision dot, as a fraction of the icon size. */
const TILE_SPEC_DOT_R = 0.06;

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
/**
 * The disc's radius as a fraction of the field's short side.
 *
 * It opens at the icon's own footprint rather than at zero. The icon is only
 * ever drawn as a hole in this disc, so a disc smaller than the icon shows
 * nothing at all: with a 0..0.46 ramp the mark was blank until p reached
 * ~0.84 — thirteen of a fourteen-frame ramp — and then appeared. Starting at
 * TILE_BLOOM_MIN_R, just past the icon's 0.387 half-extent, makes the very
 * first snap frame legible: the mark inverts from ink-on-ground to
 * negative-space-in-accent, which is what a snap should read as, and the disc
 * grows out from there.
 */
export function tileBloomRadiusScale(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return TILE_BLOOM_MIN_R + (TILE_BLOOM_MAX_R - TILE_BLOOM_MIN_R) * p;
}

/** Just clears the icon's 0.387 half-extent on the field's short side. */
const TILE_BLOOM_MIN_R = 0.4;
/** Full bloom, unchanged. */
const TILE_BLOOM_MAX_R = 0.46;

function drawTileBloom(
  o: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  progress: number,
): void {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return;

  // The fill is a genuinely solid disc — the ask was a real background fill,
  // not an outline or a stipple. It carries the step's accent through the
  // engine's single per-frame colour channel: the disc is the only thing
  // drawn into the alpha buffer this pass, so every lit cell renders in the
  // accent. The icon itself is punched out of the disc by eraseTileGlyph and
  // redrawn in ink outside it, which keeps the mark legible on every tone —
  // including `ink`, where an accent-coloured glyph would sit on itself.
  o.save();
  o.shadowBlur = 0;
  o.beginPath();
  o.arc(cols * 0.5, rows * 0.5, Math.min(cols, rows) * tileBloomRadiusScale(p), 0, FULL_TURN);
  o.fill();
  o.restore();
}

/**
 * A minimal path stand-in for the two runtimes that lack Path2D (Node's test
 * runners). It records the calls; `strokePath` replays them into whatever
 * context it is handed — a real canvas in the browser, a stub in tests.
 * Browsers always have Path2D; production drawing never depends on this.
 */
type PathCall = { fn: string; args: unknown[] };

interface GlyphPath {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  rect(x: number, y: number, w: number, h: number): void;
}

function glyphPath(): GlyphPath & { calls: PathCall[] } {
  const calls: PathCall[] = [];
  return {
    calls,
    moveTo: (...args) => void calls.push({ fn: 'moveTo', args }),
    lineTo: (...args) => void calls.push({ fn: 'lineTo', args }),
    closePath: () => void calls.push({ fn: 'closePath', args: [] }),
    arc: (...args) => void calls.push({ fn: 'arc', args }),
    rect: (...args) => void calls.push({ fn: 'rect', args }),
  } as GlyphPath & { calls: PathCall[] };
}

/** Replays a recorded glyph path into a 2D context (real or stub). */
function strokeGlyph(o: CanvasRenderingContext2D, path: ReturnType<typeof glyphPath>): void {
  o.beginPath();
  for (const { fn, args } of path.calls) {
    if (fn === 'moveTo' || fn === 'lineTo') {
      const [x, y] = args as [number, number];
      if (fn === 'moveTo') o.moveTo(x, y);
      else o.lineTo(x, y);
    } else if (fn === 'closePath') {
      o.closePath();
    } else if (fn === 'arc') {
      const [x, y, r, a0, a1] = args as [number, number, number, number, number];
      o.arc(x, y, r, a0, a1);
    } else if (fn === 'rect') {
      const [x, y, w, h] = args as [number, number, number, number];
      o.rect(x, y, w, h);
    }
  }
  o.stroke();
}

/** The tile icon as a recorded path in unit space scaled to `s`. */
function tileGlyphPath(
  kind: StageKind,
  s: number,
  options?: { specDot?: boolean },
): ReturnType<typeof glyphPath> {
  const path = glyphPath();
  const line = (ax: number, ay: number, bx: number, by: number): void => {
    path.moveTo(ax * s, ay * s);
    path.lineTo(bx * s, by * s);
  };

  switch (kind) {
    case 'read':
      line(0.24, 0.22, 0.24, 0.78);
      line(0.38, 0.28, 0.78, 0.28);
      line(0.38, 0.5, 0.66, 0.5);
      line(0.38, 0.72, 0.74, 0.72);
      break;
    case 'spec': {
      path.moveTo(0.5 * s, 0.14 * s);
      path.lineTo(0.84 * s, 0.5 * s);
      path.lineTo(0.5 * s, 0.86 * s);
      path.lineTo(0.16 * s, 0.5 * s);
      path.closePath();
      if (options?.specDot !== false) {
        path.moveTo((0.5 + TILE_SPEC_DOT_R) * s, 0.5 * s);
        path.arc(0.5 * s, 0.5 * s, TILE_SPEC_DOT_R * s, 0, FULL_TURN);
      }
      break;
    }
    case 'build':
      line(0.18, 0.78, 0.39, 0.78);
      line(0.39, 0.78, 0.39, 0.58);
      line(0.39, 0.58, 0.6, 0.58);
      line(0.6, 0.58, 0.6, 0.38);
      line(0.6, 0.38, 0.81, 0.38);
      line(0.68, 0.25, 0.81, 0.38);
      line(0.81, 0.38, 0.68, 0.51);
      break;
    case 'harden':
      path.moveTo(0.3 * s, 0.39 * s);
      path.arc(0.5 * s, 0.39 * s, 0.2 * s, Math.PI, 0);
      path.rect(0.25 * s, 0.39 * s, 0.5 * s, 0.4 * s);
      break;
  }
  return path;
}

/**
 * How much wider the eraser runs than the glyph's own stroke, in the same
 * unit-stroke units. The punch must fully clear the accent from behind the
 * area the resting glyph occupies, with margin for the cell grid's sampling.
 */
const GLYPH_PUNCH_WIDTH_SCALE = 3.7;

/** Erases the icon from the buffer with a wider stroke of the same geometry. */
function eraseTileGlyph(o: CanvasRenderingContext2D, kind: StageKind, s: number): void {
  const base =
    kind === 'read' || kind === 'spec'
      ? Math.min(1, s * 0.048)
      : kind === 'build'
        ? Math.min(1, s * 0.04)
        : Math.min(1, s * 0.032);

  o.save();
  o.globalCompositeOperation = 'destination-out';
  o.lineWidth = base * GLYPH_PUNCH_WIDTH_SCALE;
  o.lineJoin = 'miter';
  strokeGlyph(o, tileGlyphPath(kind, s));
  o.restore();
}

/** One simple icon, centred and fitted to the authoring tile grid. */
export function tileStage(kind: StageKind): FieldSource {
  return (o, { cols, rows, progress = 0 }) => {
    drawTileBloom(o, cols, rows, progress);

    const s = Math.min(cols, rows) * 0.88;
    o.save();
    o.shadowBlur = 0;
    o.translate((cols - s) / 2, (rows - s) / 2);

    if (progress > 0) {
      // Snap pass: the disc carries the accent, so the icon must not paint
      // into it. The erase alone is the knockout — the engine samples only
      // alpha, so erased cells fall through to the page ground and every
      // surviving cell renders in the accent. No ink repaint here: it would
      // land inside the disc and be drawn in the accent over itself.
      eraseTileGlyph(o, kind, s);
    } else {
      // Resting pass: plain ink icon over the bare field.
      TILE_GLYPHS[kind](o, s);
    }
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
