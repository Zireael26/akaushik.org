/**
 * The footer skyline that closes every public page.
 *
 * Ported from gaurijha.com's src/scripts/skyline.ts. Three buildings repeat
 * across the strip in order — the Supreme Court (dome, finial, two chhatri wings,
 * a 13-column colonnade), India Gate, and a pedimented courthouse — spaced by a
 * hash-driven gap, with colourful filler stacks in the gaps between them.
 *
 * Static art: built once, rebuilt on resize and on theme change.
 *
 * Two deliberate changes from the source, both forced by this codebase:
 *
 *   1. mountSkyline takes its canvas as an argument rather than querying for a
 *      data attribute. The React wrapper already holds the ref; re-querying the
 *      document from inside would be a second source of truth.
 *   2. It returns a teardown. The original mounted once for the lifetime of the
 *      document and never cleaned up. Under React that leaks a resize listener
 *      and a theme subscription on every remount — so listeners go through an
 *      AbortController and the caller gets a disposer.
 */
import { PALETTE, deepBlue, h, navy } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

const CELL = 7;
const ROWS = 16;

export function mountSkyline(canvas: HTMLCanvasElement): () => void {
  const ac = new AbortController();
  const { signal } = ac;
  let disposed = false;

  function build(): void {
    const w = canvas.clientWidth;
    if (!w) return;
    const dark = isDark();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * d;
    canvas.height = ROWS * CELL * d;
    canvas.style.height = `${ROWS * CELL}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, ROWS * CELL);

    const cols = Math.ceil(w / CELL);
    const R = ROWS;
    const oc = document.createElement('canvas');
    oc.width = cols;
    oc.height = ROWS;
    const o = oc.getContext('2d')!;
    o.fillStyle = PALETTE.navy;

    // Three towers, not three monuments. gaurijha's skyline was the Delhi
    // legal one — Supreme Court, India Gate, a pedimented courthouse — which
    // is hers and means nothing here. These are the equivalent landmarks for
    // this site: the machine you rent, the thing you build on it, and the frame
    // that holds the process together. Each returns its own width in cells.

    /** A server rack: posts, rails, unit slats, and two status lamps. */
    const rack = (x: number): number => {
      const W = 18;
      o.fillRect(x + 1, R - 14, 1.4, 14);
      o.fillRect(x + W - 2.4, R - 14, 1.4, 14);
      o.fillRect(x + 1, R - 14, W - 2, 1.4);
      o.fillRect(x, R - 2, W, 2);
      for (let i = 0; i < 5; i++) o.fillRect(x + 3.2, R - 11.6 + i * 2.1, W - 6.4, 1.1);
      // Lamps are the one warm note in a navy silhouette, same trick the
      // original used for its filler stacks.
      o.fillStyle = PALETTE.amber;
      o.fillRect(x + W - 4.6, R - 11.4, 0.9, 0.9);
      o.fillStyle = PALETTE.lime;
      o.fillRect(x + W - 4.6, R - 7.2, 0.9, 0.9);
      o.fillStyle = navy(dark);
      return W;
    };

    /** A layered stack, narrowing upward, with a mast. The modular monolith. */
    const stack = (x: number): number => {
      const W = 14;
      o.fillRect(x, R - 3, W, 3);
      o.fillRect(x + 1.5, R - 6, W - 3, 3);
      o.fillRect(x + 3, R - 9, W - 6, 3);
      o.fillRect(x + 4.5, R - 12, W - 9, 3);
      o.fillRect(x + W / 2 - 0.4, R - 15, 0.8, 3);
      o.fillStyle = PALETTE.red;
      o.fillRect(x + W / 2 - 0.5, R - 15.8, 1, 1);
      o.fillStyle = navy(dark);
      return W;
    };

    /** A trellis panel on legs — the hero's third exhibit, at skyline scale. */
    const trellis = (x: number): number => {
      const W = 22;
      const T = R - 13;
      const B = R - 3;
      o.fillRect(x + 1, T, W - 2, 1.2);
      o.fillRect(x + 1, B - 1.2, W - 2, 1.2);
      o.fillRect(x + 1, T, 1.2, B - T);
      o.fillRect(x + W - 2.2, T, 1.2, B - T);
      o.save();
      o.beginPath();
      o.rect(x + 2, T + 1, W - 4, B - T - 2);
      o.clip();
      o.strokeStyle = navy(dark);
      o.lineWidth = 0.9;
      for (let d = -(B - T); d < W + (B - T); d += 5) {
        o.beginPath();
        o.moveTo(x + d, T);
        o.lineTo(x + d + (B - T), B);
        o.stroke();
        o.beginPath();
        o.moveTo(x + d, B);
        o.lineTo(x + d + (B - T), T);
        o.stroke();
      }
      o.restore();
      o.fillRect(x + 2.5, B, 1.2, 3);
      o.fillRect(x + W - 4, B, 1.2, 3);
      return W;
    };

    const kinds = [rack, stack, trellis];
    const widths = [18, 14, 22];
    const mask = new Uint8Array(cols);
    let x = 2;
    let k = 0;
    let drawn = 0;
    while (x + widths[k % 3]! + 8 < cols) {
      x += Math.floor(6 + h(x, 9.7) * 12);
      if (x + widths[k % 3]! + 2 > cols) break;
      const bw = kinds[k % 3]!(x);
      for (let i = Math.max(0, x - 1); i < Math.min(cols, x + bw + 1); i++) mask[i] = 1;
      x += bw;
      k++;
      drawn++;
    }
    // A narrow strip still deserves one tower rather than only filler stacks.
    if (!drawn && cols > 26) {
      const bx = Math.floor(cols / 2) - 11;
      const bw = trellis(bx);
      for (let i = Math.max(0, bx - 1); i < Math.min(cols, bx + bw + 1); i++) mask[i] = 1;
    }

    const img = o.getImageData(0, 0, cols, ROWS).data;
    const pal = [PALETTE.amber, PALETTE.red, PALETTE.cobalt, PALETTE.lime];
    for (let yy = 0; yy < ROWS; yy++) {
      for (let xx = 0; xx < cols; xx++) {
        if (img[(yy * cols + xx) * 4 + 3]! <= 100) continue;
        const hv = h(xx * 3 + 2, yy * 5 + 4);
        ctx.fillStyle =
          hv > 0.92
            ? pal[Math.floor(hv * 40) % 4]!
            : hv > 0.52
              ? navy(dark)
              : hv > 0.24
                ? PALETTE.cobalt
                : deepBlue(dark);
        ctx.fillRect(xx * CELL, yy * CELL, CELL - 1, CELL - 1);
      }
    }

    for (let xx = 0; xx < cols; xx++) {
      if (mask[xx]) continue;
      const hh = h(xx * 1.7 + 5, 3.1);
      if (hh < 0.3) continue;
      const hgt = Math.floor(1 + hh * hh * 4);
      for (let y = 0; y < hgt; y++) {
        const r = h(xx * 7 + 5, y * 13 + 1);
        if (r < 0.25) continue;
        ctx.fillStyle = pal[Math.floor(r * pal.length) % pal.length]!;
        ctx.fillRect(xx * CELL, (ROWS - 1 - y) * CELL, CELL - 1, CELL - 1);
      }
    }
  }

  window.addEventListener('resize', build, { signal });
  const unsubscribeTheme = onThemeChange(build);

  if (document.fonts?.ready) {
    // Building metrics don't depend on type, but the rebuild is free and keeps
    // parity with the source's font-load repaint. Skip it if already disposed.
    void document.fonts.ready.then(() => {
      if (!disposed) build();
    });
  }

  build();

  return () => {
    disposed = true;
    ac.abort();
    unsubscribeTheme();
  };
}
