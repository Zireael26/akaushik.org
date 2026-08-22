/**
 * The static pixel band under the writing index hero.
 *
 * Ported from gaurijha.com's src/scripts/pixel-band.ts (tag public-site-v1) —
 * the same diagonal current as the method band but frozen: no time term, a 0.53
 * gate, a (v-0.5)*5 hash gate, and a cobalt/navy field with amber, red and lime
 * sprinkles above 0.94.
 *
 * Two deliberate changes from the source, both forced by this codebase:
 *
 *   1. mountPixelBand takes its canvas as an argument rather than querying for
 *      a data attribute. The React wrapper already holds the ref; re-querying
 *      the document from inside would be a second source of truth.
 *   2. It returns a teardown. The original mounted once for the lifetime of the
 *      document and never cleaned up; listeners go through an AbortController
 *      and the theme subscription is unsubscribed on disposal, so StrictMode's
 *      double-mount in dev is a no-op rather than two competing rebuilds.
 *
 * The art is unchanged: 6px cells, the two-octave value noise at 0.18/0.07 and
 * 0.06/0.03 along the rotated axes, and every hash offset below.
 */
import { PALETTE, h, navy } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

/** Cell size in CSS px; a cell is a square with a 1px gutter. */
const CELL = 6;

/** Smoothstep-interpolated value noise over the shared hash. */
function noise(x: number, y: number): number {
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
}

export function mountPixelBand(canvas: HTMLCanvasElement): () => void {
  const ac = new AbortController();

  function build(): void {
    const w = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!w) return;
    const dark = isDark();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * d;
    canvas.height = height * d;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, height);

    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(height / CELL);
    const sprinkle = [PALETTE.amber, PALETTE.red, PALETTE.lime];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const sd = (x - y) * 0.7071;
        const u2 = (x + y) * 0.7071;
        const v = 0.6 * noise(sd * 0.18, u2 * 0.07) + 0.4 * noise(sd * 0.06, u2 * 0.03);
        if (v < 0.53) continue;
        const r2 = h(x * 3.1 + 7, y * 5.3 + 2);
        if (r2 > (v - 0.5) * 5) continue;
        const hv = h(x * 1.3, y * 2.7);
        ctx.fillStyle =
          hv > 0.94 ? sprinkle[Math.floor(hv * 300) % 3]! : hv > 0.5 ? PALETTE.cobalt : navy(dark);
        ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
      }
    }
  }

  window.addEventListener('resize', build, { signal: ac.signal });
  const unsubscribeTheme = onThemeChange(build);
  build();

  return () => {
    ac.abort();
    unsubscribeTheme();
  };
}
