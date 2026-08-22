/**
 * The method flow band — a drifting diagonal current in four colour zones.
 *
 * Ported from gaurijha.com's src/scripts/method-band.ts (_mkMeth/_drawMeth):
 * 6px cells, the 0.52 noise gate, the (v-0.5)*6 hash gate, the jittered zone
 * boundaries, and the dim-to-8%-ink treatment when one [data-mstep] column is
 * hovered.
 *
 * Same two forced changes as the heatfield port:
 *
 *   1. mountMethodBand takes its canvas and returns a teardown. Listeners go
 *      through an AbortController so StrictMode's double-mount cannot leak a
 *      rAF loop or a resize listener.
 *   2. The canvas arrives as an argument instead of a data-attribute query.
 *      The one document query the engine keeps is the [data-mstep] list, read
 *      once at mount — the steps are section content, not the island's own
 *      surface, so their rects are measured per frame from cached elements.
 */
import { PALETTE, h, inkAlpha, navy, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

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

export function mountMethodBand(canvas: HTMLCanvasElement): () => void {
  const noise = makeNoise();
  const ac = new AbortController();
  const { signal } = ac;

  // The step columns live in the surrounding section; cache them once. No
  // steps (or malformed data-mstep values) simply means hovered stays -1.
  const steps = Array.from(document.querySelectorAll<HTMLElement>('[data-mstep]'));

  let ctx: CanvasRenderingContext2D | null = null;
  let dpr = 1;
  const cell = 6;
  let cols = 0;
  let rows = 0;
  let t = 0;
  let mx = -200;
  let my = -200;
  let raf = 0;

  function size(): void {
    const w = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!w) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    cols = Math.ceil(w / cell);
    rows = Math.ceil(height / cell);
    ctx = canvas.getContext('2d');
  }

  function draw(): void {
    if (!ctx) return;
    const dark = isDark();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const zone = [PALETTE.cobalt, PALETTE.amber, PALETTE.red, navy(dark)];

    // Which step column the pointer is over; -1 dims nothing.
    let hovered = -1;
    for (const s of steps) {
      const r = s.getBoundingClientRect();
      if (r.width && mx > r.left && mx < r.right && my > r.top && my < r.bottom) {
        const step = Number.parseInt(s.dataset.mstep ?? '', 10);
        if (!Number.isNaN(step)) hovered = step;
        break;
      }
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const sd = (x - y) * 0.7071;
        const u2 = (x + y) * 0.7071;
        const v =
          0.6 * noise(sd * 0.18 - t, u2 * 0.07) + 0.4 * noise(sd * 0.06 + t * 0.4, u2 * 0.03);
        if (v < 0.52) continue;
        const r2 = h(x * 3.1 + 7, y * 5.3 + 2);
        if (r2 > (v - 0.5) * 6) continue;
        // Zone boundaries wobble so the four bands never read as hard stripes.
        const zb = ((x + (noise(y * 0.3, x * 0.02 + t * 0.5) - 0.5) * 14) / cols) * 4;
        const z = Math.max(0, Math.min(3, Math.floor(zb)));
        ctx.fillStyle =
          hovered >= 0 && z !== hovered ? inkAlpha(dark ? 0.1 : 0.08, dark) : zone[z]!;
        ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
      }
    }
  }

  function loop(): void {
    raf = requestAnimationFrame(loop);
    if (!prefersReducedMotion()) t += 0.006;
    draw();
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      mx = e.clientX;
      my = e.clientY;
    },
    { signal },
  );
  window.addEventListener(
    'resize',
    () => {
      size();
      // Resize clears the backing store; restore the reduced-motion static frame.
      if (!raf) draw();
    },
    { signal },
  );

  // The animated loop re-reads the mode every frame; only a static
  // reduced-motion draw needs the subscription to re-theme.
  const unsubscribeTheme = onThemeChange(() => {
    if (!raf) draw();
  });

  size();
  if (prefersReducedMotion()) {
    draw();
  } else {
    raf = requestAnimationFrame(loop);
  }

  return () => {
    ac.abort();
    unsubscribeTheme();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
