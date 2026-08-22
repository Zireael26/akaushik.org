/**
 * The pixel field — the engine behind every piece of live art on this site.
 *
 * This started as the hero heatfield ported from gaurijha.com and is now
 * generalised, because the same engine turns out to be the right answer for the
 * hero, the process pipeline, per-article headers, and portraits. What varies
 * between those is only three things: what silhouette gets drawn, how dense the
 * grid is, and whether the thing responds to a pointer. Everything else — the
 * streak noise, the ambient drift, the heat decay, the palette ramp, the cell
 * rule — is shared, and duplicating it per surface is how a design language
 * rots into four slightly different design languages.
 *
 * The pipeline, unchanged from the original:
 *
 *   source draws a white silhouette into an offscreen buffer at CELL resolution
 *     -> alpha is folded with a fixed diagonal streak-noise field
 *     -> pointer heat and a two-octave ambient drift are added per frame
 *     -> intensity picks a colour off a five-stop ramp, and a per-cell hash
 *        decides whether the cell lights at all
 *
 * That last step is why it reads as art rather than as a bitmap: cells are
 * sparse and stochastic, but the hash is deterministic, so the same field draws
 * identically on every load. Never introduce Math.random here.
 *
 * Constants carried from the prototype and load-bearing: the R=9 diagonal
 * brush, 0.97 heat decay, 1.7 ring step, 0.006 ambient tick recomputed every
 * 2nd frame, 0.022 stage blend, and the 0.09/1.4/1.05/0.8/0.55/0.3 thresholds
 * in the draw pass.
 */
import { PALETTE, canvasBg, h, navy, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

/** TS 6 makes Float32Array generic over its buffer; every grid here is plain-backed. */
export type Grid = Float32Array<ArrayBuffer>;

export type SourceContext = {
  /** Grid width in cells. */
  cols: number;
  /** Grid height in cells. */
  rows: number;
  /**
   * The swing angle, in radians, driven by the click spring. Only sources that
   * opt into `swing` ever see anything but 0.
   */
  angle: number;
  /** Ambient clock, for sources that want to animate their own geometry. */
  t: number;
  /**
   * Per-instance offset into the shared hash. Two fields with different seeds
   * draw the same shape with different noise, which is what gives every article
   * header its own texture without anyone authoring one.
   */
  seed: number;
};

/**
 * A source draws a white silhouette. Alpha is what the engine samples, so a
 * source that wants to express brightness (an image, say) must convert
 * luminance to alpha itself before returning.
 */
export type FieldSource = (o: CanvasRenderingContext2D, c: SourceContext) => void;

export type FieldPreset = 'hero' | 'band' | 'tile' | 'strip';

/**
 * Target cell size in CSS pixels, per preset.
 *
 * This is deliberately a cell size rather than a column count. A column count
 * only makes sense for a field as wide as the hero: the same 150 columns across
 * a 135px-tall band leaves thirteen rows to draw into, and a glyph with any
 * internal detail — a ruled sheet, a branch, a gate — disintegrates. Fixing the
 * cell instead means small fields get proportionally more rows, which is what
 * legibility actually depends on.
 */
const PRESET_CELL: Record<FieldPreset, number> = {
  hero: 6.5,
  band: 4,
  tile: 3,
  strip: 5,
};

/**
 * Intensity multiplier per preset. Small fields carry thin strokes, and after
 * the streak fold a thin stroke sits low enough that the per-cell hash culls
 * most of it. Lifting the gain keeps the sparse, stochastic look while making
 * sure a 2-cell-wide line survives it.
 */
const PRESET_GAIN: Record<FieldPreset, number> = {
  hero: 1,
  band: 1.25,
  tile: 1.35,
  strip: 1.15,
};

/**
 * How much of the streak field lights up on its own, independent of the shape.
 *
 * At hero scale this is the whole atmosphere — the drifting scatter around the
 * subject is most of why the field reads as weather rather than as clip art. At
 * tile scale the same value is just noise sitting on top of a 30-row glyph, and
 * it wins, because there is far less shape for it to sit around. Small fields
 * keep a trace of it and no more.
 */
const PRESET_SHAPE_NOISE: Record<FieldPreset, number> = {
  hero: 0.4,
  band: 0.22,
  tile: 0.12,
  strip: 0.3,
};

const PRESET_SCATTER: Record<FieldPreset, number> = {
  hero: 1,
  band: 0.28,
  tile: 0.16,
  strip: 0.6,
};

export type FieldOptions = {
  /**
   * One entry per stage. A single-entry array is a static field; more than one
   * makes the field steppable, and it cross-fades between them at 0.022/frame.
   */
  sources: readonly FieldSource[];
  preset?: FieldPreset;
  /** Overrides the preset's cell size, in CSS pixels. */
  cellSize?: number;
  /** Overrides the preset's intensity multiplier. */
  gain?: number;
  /** Overrides how much shape-independent scatter the field carries, 0..1. */
  scatter?: number;
  /**
   * How much the streak field eats into the silhouette itself, 0..1. High
   * values dissolve the subject into the weather, which is the hero's whole
   * character; at tile scale the same value erodes a 30-row glyph until its
   * outline stops being readable.
   */
  shapeNoise?: number;
  /** Pointer paints heat; clicks fire expanding rings. */
  interactive?: boolean;
  /** Clicking advances the stage. Ignored when there is only one source. */
  cycleOnClick?: boolean;
  /**
   * Clicking left or right of centre swings the art on a spring, the way the
   * hero's agent graph does. Only meaningful for sources that read `angle`.
   */
  swing?: boolean;
  /** Ambient drift. Off makes the field static apart from pointer heat. */
  ambient?: boolean;
  /** Per-instance hash offset. Same seed, same texture, every load. */
  seed?: number;
  /** Called when the stage changes, however it changed. */
  onStage?: (index: number) => void;
};

export type FieldHandle = {
  dispose(): void;
  /** Cross-fade to a stage. Out-of-range indices are ignored. */
  setStage(index: number): void;
  stage(): number;
};

/** Smoothstep-interpolated value noise over the shared hash. */
function makeNoise(seed: number): (x: number, y: number) => number {
  return (x: number, y: number): number => {
    const xi = Math.floor(x) + seed;
    const yi = Math.floor(y) + seed;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return (
      h(xi, yi) * (1 - u) * (1 - v) +
      h(xi + 1, yi) * u * (1 - v) +
      h(xi, yi + 1) * (1 - u) * v +
      h(xi + 1, yi + 1) * u * v
    );
  };
}

type Ring = { x: number; y: number; r: number };

export function mountField(canvas: HTMLCanvasElement, options: FieldOptions): FieldHandle {
  const {
    sources,
    preset = 'hero',
    cellSize = PRESET_CELL[preset],
    gain = PRESET_GAIN[preset],
    scatter = PRESET_SCATTER[preset],
    shapeNoise = PRESET_SHAPE_NOISE[preset],
    interactive = false,
    cycleOnClick = false,
    swing = false,
    ambient = true,
    seed = 0,
    onStage,
  } = options;

  const noise = makeNoise(seed);
  const offscreen = document.createElement('canvas');
  const ac = new AbortController();
  const { signal } = ac;

  let ctx: CanvasRenderingContext2D | null = null;
  let dpr = 1;
  let cell = 3;
  let cols = 0;
  let rows = 0;

  let rnd: Grid = new Float32Array(0);
  let stk: Grid = new Float32Array(0);
  let heat: Grid = new Float32Array(0);
  let amb: Grid = new Float32Array(0);
  let base: Grid = new Float32Array(0);
  let from: Grid | null = null;
  let to: Grid | null = null;

  let t = 0;
  let frame = 0;
  let rings: Ring[] = [];
  let angle = 0;
  let vel = 0;
  let stageIndex = 0;
  let clicks = 0;
  let blend = 1;
  let dirty = false;
  let drawn = false;
  let raf = 0;

  /**
   * Renders one stage into the offscreen buffer at cell resolution, then folds
   * the diagonal streak noise into it. Writes into `out` when given so the
   * swing spring can rebuild every frame without allocating.
   */
  function build(index: number, out?: Grid): Grid {
    const octx = offscreen.getContext('2d')!;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, cols, rows);
    octx.fillStyle = '#fff';
    octx.strokeStyle = '#fff';
    octx.shadowColor = 'rgba(255,255,255,.95)';
    octx.shadowBlur = 8;
    octx.lineCap = 'butt';
    octx.lineJoin = 'miter';

    const source = sources[index] ?? sources[0];
    source?.(octx, { cols, rows, angle, t, seed });

    const img = octx.getImageData(0, 0, cols, rows).data;
    const target: Grid = out && out.length === cols * rows ? out : new Float32Array(cols * rows);
    for (let i = 0; i < target.length; i++) {
      const shape = img[i * 4 + 3]! / 255;
      const streak = stk[i]!;
      target[i] = Math.min(
        1.2,
        (shape * (1 - shapeNoise + shapeNoise * streak * 1.75) +
          Math.max(0, streak - 0.6) * 0.6 * scatter) *
          gain,
      );
    }
    dirty = true;
    return target;
  }

  /** The elliptical diagonal brush that paints heat under the pointer. */
  function paint(px: number, py: number, amt: number): void {
    const R = 9;
    for (let y = Math.max(0, Math.floor(py - R)); y < Math.min(rows, py + R); y++) {
      for (let x = Math.max(0, Math.floor(px - R)); x < Math.min(cols, px + R); x++) {
        const dx = x - px;
        const dy = y - py;
        const a = (dx + dy) * 0.7071;
        const b = (dx - dy) * 0.7071;
        const d = (a * a) / (R * R) + (b * b) / (R * R * 0.16);
        if (d < 1) {
          const i = y * cols + x;
          heat[i] = Math.min(1.3, heat[i]! + amt * (1 - d));
        }
      }
    }
    dirty = true;
  }

  /** Two-octave drift, the slow meditative motion under everything. */
  function drift(): void {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const s = (x - y) * 0.7071;
        const u = (x + y) * 0.7071;
        const a =
          0.6 * noise(s * 0.2 - t, u * 0.05 + t * 0.13) + 0.4 * noise(s * 0.08 + t * 0.5, u * 0.03);
        amb[y * cols + x] = Math.max(0, a - 0.52) * 0.62;
      }
    }
  }

  function draw(): void {
    if (!ctx) return;
    const dark = isDark();
    ctx.fillStyle = canvasBg(dark);
    ctx.fillRect(0, 0, cols * cell, rows * cell);
    const colors = [navy(dark), PALETTE.cobalt, PALETTE.amber, PALETTE.red, PALETTE.lime];
    const size = Math.max(1, cell - dpr);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const r = rnd[idx]!;
        const i = base[idx]! + heat[idx]! + amb[idx]!;
        // Sparse by design: a cell lights only when its hash falls under intensity.
        if (i <= 0.09 || r > i * 1.4) continue;
        const v = i + (r - 0.5) * 0.16;
        const c = v > 1.05 ? 4 : v > 0.8 ? 3 : v > 0.55 ? 2 : v > 0.3 ? 1 : 0;
        ctx.fillStyle = colors[c]!;
        ctx.fillRect(x * cell, y * cell, size, size);
      }
    }
  }

  function loop(): void {
    raf = requestAnimationFrame(loop);
    const rm = prefersReducedMotion();
    let any = false;

    for (let i = 0; i < heat.length; i++) {
      if (heat[i]! > 0.004) {
        heat[i]! *= 0.97;
        any = true;
      } else if (heat[i]) {
        heat[i] = 0;
      }
    }

    if (rings.length) {
      const maxR = Math.max(cols, rows) * 0.5;
      for (const g of rings) {
        g.r += 1.7;
        const fall = Math.max(0, 1 - g.r / maxR);
        if (fall <= 0) continue;
        const steps = Math.max(24, Math.floor(g.r * 5));
        for (let k = 0; k < steps; k++) {
          const th = (k / steps) * 6.2832;
          const x = Math.round(g.x + Math.cos(th) * g.r);
          const y = Math.round(g.y + Math.sin(th) * g.r * 0.75);
          if (x >= 0 && x < cols && y >= 0 && y < rows) {
            const i = y * cols + x;
            heat[i] = Math.min(1.3, heat[i]! + fall * 0.55);
          }
        }
      }
      rings = rings.filter((g) => g.r < maxR);
      any = true;
    }

    if (!rm && ambient) {
      t += 0.006;
      frame++;
      if (frame % 2 === 0) drift();
      any = true;
    }

    if (blend < 1 && to && from) {
      blend = Math.min(1, blend + 0.022);
      const e = blend * blend * (3 - 2 * blend);
      for (let i = 0; i < base.length; i++) base[i] = from[i]! + (to[i]! - from[i]!) * e;
      if (blend >= 1) {
        from = null;
        to = null;
      }
      any = true;
    } else if (swing && (Math.abs(vel) > 0.0004 || Math.abs(angle) > 0.0008)) {
      vel += -angle * 0.0018;
      vel *= 0.985;
      angle = Math.max(-0.22, Math.min(0.22, angle + vel));
      build(stageIndex, base);
      any = true;
    } else if (swing && angle !== 0) {
      angle = 0;
      vel = 0;
      build(stageIndex, base);
    }

    if (any || dirty || !drawn) {
      draw();
      dirty = false;
      drawn = true;
    }
  }

  function toGrid(e: PointerEvent): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * cols, ((e.clientY - r.top) / r.height) * rows];
  }

  function goToStage(index: number, animate = true): void {
    if (sources.length < 2) return;
    const next = ((index % sources.length) + sources.length) % sources.length;
    if (next === stageIndex && animate) return;
    stageIndex = next;
    angle = 0;
    vel = 0;
    if (animate) {
      from = Float32Array.from(base);
      to = build(stageIndex);
      blend = 0;
    } else {
      base = build(stageIndex, base);
    }
    onStage?.(stageIndex);
  }

  function setup(): void {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx = canvas.getContext('2d');
    cell = Math.max(2, Math.round(cellSize)) * dpr;
    cols = Math.ceil(canvas.width / cell);
    rows = Math.ceil(canvas.height / cell);
    offscreen.width = cols;
    offscreen.height = rows;

    rnd = new Float32Array(cols * rows);
    stk = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const s = (x - y) * 0.7071;
        const u = (x + y) * 0.7071;
        stk[y * cols + x] = 0.55 * noise(s * 0.5, u * 0.1) + 0.45 * noise(s * 0.2, u * 0.05);
        rnd[y * cols + x] = h(x * 3.7 + 1 + seed, y * 7.3 + 2 + seed);
      }
    }

    heat = new Float32Array(cols * rows);
    amb = new Float32Array(cols * rows);
    t = 0;
    rings = [];
    angle = 0;
    vel = 0;
    clicks = 0;
    blend = 1;
    from = null;
    to = null;
    drawn = false;
    base = build(stageIndex);

    if (!raf) loop();
  }

  if (interactive) {
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (prefersReducedMotion()) return;
        const [x, y] = toGrid(e);
        paint(x, y, 0.35);
      },
      { signal },
    );

    canvas.addEventListener(
      'pointerdown',
      (e) => {
        const [x, y] = toGrid(e);
        rings.push({ x, y, r: 1.5 });
        if (prefersReducedMotion()) return;
        clicks++;
        // With both set, clicks alternate: odd ones swing the art on its spring,
        // even ones advance the stage. Advancing on every click makes the field
        // feel like a slideshow; alternating is what gives it the sense that the
        // thing is a physical object you can knock before it changes.
        if (cycleOnClick && (!swing || clicks % 2 === 0)) {
          goToStage(stageIndex + 1);
        } else if (swing) {
          vel += (x < cols * 0.5 ? -1 : 1) * 0.008;
        }
      },
      { signal },
    );
  }

  window.addEventListener('resize', setup, { signal });
  const unsubscribeTheme = onThemeChange(() => {
    dirty = true;
  });

  if (document.fonts?.ready) {
    // Sources that set type need the face before their metrics mean anything.
    void document.fonts.ready.then(() => {
      if (cols) base = build(stageIndex, base);
    });
  }

  setup();

  return {
    dispose(): void {
      ac.abort();
      unsubscribeTheme();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    setStage(index: number): void {
      goToStage(index);
    },
    stage(): number {
      return stageIndex;
    },
  };
}
