/**
 * The Delhi legal skyline that closes every public page.
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

    const supremeCourt = (x: number): number => {
      const cx = x + 23;
      o.fillRect(x + 1, R - 2, 44, 2);
      o.fillRect(x + 3, R - 7, 40, 2);
      for (let i = 0; i < 13; i++) o.fillRect(x + 4 + i * 3, R - 5, 2, 3);
      o.beginPath();
      o.arc(cx, R - 7, 5, Math.PI, 0);
      o.fill();
      o.fillRect(cx - 6, R - 8, 12, 1);
      o.fillRect(cx - 0.8, R - 13.6, 1.6, 1.8);
      for (const s of [-16, 16]) {
        o.beginPath();
        o.arc(cx + s, R - 10, 2.4, Math.PI, 0);
        o.fill();
        o.fillRect(cx + s - 3, R - 10, 6, 1);
        o.fillRect(cx + s - 2.5, R - 9, 1, 2);
        o.fillRect(cx + s + 1.5, R - 9, 1, 2);
      }
      return 46;
    };

    const indiaGate = (x: number): number => {
      o.fillRect(x + 8, R - 16, 4, 1);
      o.fillRect(x + 2, R - 15, 16, 1);
      o.fillRect(x + 3, R - 14, 14, 3);
      o.fillRect(x + 3, R - 11, 4, 11);
      o.fillRect(x + 13, R - 11, 4, 11);
      return 20;
    };

    const courthouse = (x: number): number => {
      o.beginPath();
      o.moveTo(x + 1, R - 9);
      o.lineTo(x + 14, R - 14);
      o.lineTo(x + 27, R - 9);
      o.closePath();
      o.fill();
      o.fillRect(x + 2, R - 9, 24, 1.6);
      for (let i = 0; i < 6; i++) o.fillRect(x + 3 + i * 4, R - 7, 2, 5);
      o.fillRect(x + 1, R - 2, 26, 2);
      return 28;
    };

    const kinds = [supremeCourt, indiaGate, courthouse];
    const widths = [46, 20, 28];
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
    // A narrow strip still deserves one building rather than only filler stacks.
    if (!drawn && cols > 32) {
      const bx = Math.floor(cols / 2) - 14;
      courthouse(bx);
      for (let i = Math.max(0, bx - 1); i < Math.min(cols, bx + 29); i++) mask[i] = 1;
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
