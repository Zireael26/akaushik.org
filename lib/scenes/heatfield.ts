/**
 * The heatfield hero — the site's centrepiece.
 *
 * Ported from gaurijha.com's src/scripts/heatfield.ts, which was itself ported
 * from the _setup/_build/_paint/_ambient/_loop/_draw engine in the Claude Design
 * prototype. Every constant here is the prototype's: the 240-column density, the
 * R=9 diagonal brush, the 0.97 decay, the 1.7 ring step, the 0.006 ambient tick
 * recomputed every 2nd frame, the 0.022 exhibit blend, the ±0.22rad beam clamp
 * with its 0.0018 restoring force and 0.985 damping, and the
 * 0.09/1.4/1.05/0.8/0.55/0.3 thresholds in the draw pass.
 *
 * Two deliberate changes from the source, both forced by this codebase:
 *
 *   1. mountHeatfield returns a teardown. The original mounted once for the
 *      lifetime of the document and never cleaned up. Under React that leaks a
 *      rAF loop and a resize listener on every remount, and StrictMode in dev
 *      mounts twice — so listeners go through an AbortController and the caller
 *      gets a disposer.
 *   2. The engine takes its canvas as an argument rather than querying for a
 *      data attribute. The React wrapper already holds the ref; re-querying the
 *      document from inside would be a second source of truth.
 *
 * The ART is still Gauri's — scales, §, gavel — on purpose. Porting the engine
 * unchanged first means any fidelity gap is attributable to the port. The four
 * exhibits get re-drawn next; only the wordmark is already switched to "AK.".
 */
import { PALETTE, canvasBg, h, navy, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

/** Target column count; cell size falls out of it. */
const DENSITY = 240;

/** Fired on the canvas when the pivot zone is triple-clicked. */
export const SECRET_EVENT = 'pixel:secret';

type Ring = { x: number; y: number; r: number };

/** TS 6 makes Float32Array generic over its buffer; every grid here is plain-backed. */
type Grid = Float32Array<ArrayBuffer>;

/** Smoothstep-interpolated value noise over the shared hash. */
function makeNoise(): (x: number, y: number) => number {
  return (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
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

export function mountHeatfield(canvas: HTMLCanvasElement): () => void {
  const noise = makeNoise();
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
  let art = 0;
  let clicks = 0;
  let blend = 1;
  let dirty = false;
  let drawn = false;
  let raf = 0;

  /** Triple-click tracking for the pivot zone. */
  let secretCount = 0;
  let secretAt = 0;

  /**
   * Renders one exhibit into the offscreen buffer at cell resolution, then folds
   * the diagonal streak noise into it. Writes into `out` when given so the beam
   * spring can rebuild every frame without allocating.
   */
  function build(which: number, out?: Grid): Grid {
    const octx = offscreen.getContext('2d')!;
    octx.clearRect(0, 0, cols, rows);
    octx.fillStyle = '#fff';
    octx.strokeStyle = '#fff';
    octx.shadowColor = 'rgba(255,255,255,.95)';
    octx.shadowBlur = 8;
    const u = rows * 0.01;

    if (which === 0) {
      const CX = cols * 0.5;
      const TOP = rows * 0.1;
      const W = cols * 0.17;
      const POST = rows * 0.6;
      const a = angle;
      octx.beginPath();
      octx.arc(CX, TOP - 1, 2.4, 0, 7);
      octx.fill();
      octx.fillRect(CX - 1.4, TOP, 2.8, POST);
      const py = TOP + rows * 0.08;
      octx.save();
      octx.translate(CX, py);
      octx.rotate(a);
      octx.fillRect(-W, -1.3, W * 2, 2.6);
      octx.restore();
      const pan = (sx: number): void => {
        const px = CX + Math.cos(a) * W * sx;
        const pyy = py + Math.sin(a) * W * sx;
        const drop = rows * 0.22;
        const pw = cols * 0.075;
        octx.lineWidth = 1.3;
        octx.beginPath();
        octx.moveTo(px, pyy + 1);
        octx.lineTo(px - pw, pyy + drop);
        octx.moveTo(px, pyy + 1);
        octx.lineTo(px + pw, pyy + drop);
        octx.stroke();
        octx.beginPath();
        octx.ellipse(px, pyy + drop, pw * 1.2, pw * 0.6, 0, 0, Math.PI);
        octx.fill();
      };
      pan(-1);
      pan(1);
      octx.fillRect(CX - cols * 0.045, TOP + POST, cols * 0.09, 2.2);
      octx.fillRect(CX - cols * 0.08, TOP + POST + 2.2, cols * 0.16, 2.8);
    } else if (which === 1) {
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = `${Math.floor(rows * 0.86)}px Georgia, serif`;
      octx.fillText('§', cols * 0.5, rows * 0.5);
    } else if (which === 2) {
      octx.save();
      octx.translate(cols * 0.44, rows * 0.36);
      octx.rotate(-0.6);
      octx.fillRect(-u * 9, -u * 8, u * 18, u * 16);
      octx.fillRect(u * 9, -u * 2.2, u * 30, u * 4.4);
      octx.restore();
      octx.fillRect(cols * 0.5 - u * 11, rows * 0.74, u * 22, u * 3.5);
      octx.fillRect(cols * 0.5 - u * 14, rows * 0.74 + u * 3.5, u * 28, u * 3);
    } else {
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = `900 ${Math.floor(rows * 0.52)}px "Cabinet Grotesk", Arial, sans-serif`;
      octx.fillText('AK.', cols * 0.5, rows * 0.48);
    }

    const img = octx.getImageData(0, 0, cols, rows).data;
    const target: Grid = out && out.length === cols * rows ? out : new Float32Array(cols * rows);
    for (let i = 0; i < target.length; i++) {
      const shape = img[i * 4 + 3]! / 255;
      const streak = stk[i]!;
      target[i] = Math.min(1.2, shape * (0.6 + 0.7 * streak) + Math.max(0, streak - 0.6) * 0.6);
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
  function ambient(): void {
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

    // The amber baseline: a dotted rule at 82% height, only where the art is thin.
    const by = Math.floor(rows * 0.82);
    ctx.fillStyle = PALETTE.amber;
    for (let x = 0; x < cols; x += 6) {
      if (base[by * cols + x]! < 0.18) ctx.fillRect(x * cell, by * cell, size, size);
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

    if (!rm) {
      t += 0.006;
      frame++;
      if (frame % 2 === 0) ambient();
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
    } else if (art === 0 && (Math.abs(vel) > 0.0004 || Math.abs(angle) > 0.0008)) {
      vel += -angle * 0.0018;
      vel *= 0.985;
      angle = Math.max(-0.22, Math.min(0.22, angle + vel));
      build(0, base);
      any = true;
    } else if (art === 0 && angle !== 0) {
      angle = 0;
      vel = 0;
      build(0, base);
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

  function setup(): void {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx = canvas.getContext('2d');
    cell = Math.max(3, Math.round(rect.width / DENSITY)) * dpr;
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
        rnd[y * cols + x] = h(x * 3.7 + 1, y * 7.3 + 2);
      }
    }

    heat = new Float32Array(cols * rows);
    amb = new Float32Array(cols * rows);
    t = 0;
    rings = [];
    angle = 0;
    vel = 0;
    art = 0;
    clicks = 0;
    blend = 1;
    from = null;
    to = null;
    drawn = false;
    base = build(0);

    if (!raf) loop();
  }

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

      // The pivot zone, exhibit 0 only. Three hits inside 2.5s fire the secret event.
      if (art === 0 && Math.abs(x / cols - 0.5) < 0.09 && y / rows > 0.03 && y / rows < 0.32) {
        const now = performance.now();
        secretCount = secretAt && now - secretAt < 2500 ? secretCount + 1 : 1;
        secretAt = now;
        if (secretCount >= 3) {
          secretCount = 0;
          canvas.dispatchEvent(
            new CustomEvent(SECRET_EVENT, {
              bubbles: true,
              detail: { x: e.clientX, y: e.clientY },
            }),
          );
        }
        // Pivot clicks stay secret: no exhibit cycling, no tipping.
        return;
      }

      secretCount = 0;
      clicks++;
      if (prefersReducedMotion()) return;

      if (clicks % 2 === 0) {
        art = (art + 1) % 4;
        angle = 0;
        vel = 0;
        from = Float32Array.from(base);
        to = build(art);
        blend = 0;
      } else if (art === 0) {
        vel += (x < cols * 0.5 ? -1 : 1) * 0.008;
      }
    },
    { signal },
  );

  window.addEventListener('resize', setup, { signal });
  const unsubscribeTheme = onThemeChange(() => {
    dirty = true;
  });

  if (document.fonts?.ready) {
    // The wordmark exhibit is type; rebuild once the face is actually available.
    void document.fonts.ready.then(() => {
      if (art === 3) base = build(3, base);
    });
  }

  setup();

  return () => {
    ac.abort();
    unsubscribeTheme();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
