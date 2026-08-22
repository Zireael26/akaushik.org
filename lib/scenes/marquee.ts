/**
 * The footer marquee — "see you in court · " sampled from type into pixel cells.
 *
 * Ported from gaurijha.com's src/scripts/marquee.ts (itself from _mkText/_drawMq
 * in the design-refs prototype). The glyphs are rasterised once from Cabinet
 * Grotesk 500 at 16px into a 20-row grid, then every cell on the right or bottom
 * edge of a stroke is marked as an edge cell and drawn navy; interior cells are
 * amber-dominant with lime, red and cobalt sprinkles. Scroll is 0.09 cells/frame.
 *
 * Two deliberate changes from the source, both forced by this codebase:
 *
 *   1. mountMarquee takes its canvas and returns a teardown. The original
 *      queried for a data attribute and mounted once for the lifetime of the
 *      document, never cleaning up. Under React the wrapper already holds the
 *      ref, and StrictMode in dev mounts twice — so listeners go through an
 *      AbortController and the caller gets a disposer.
 *   2. The document.fonts.ready callback is guarded against firing after
 *      disposal.
 */
import { PALETTE, h, navy, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

const TEXT = 'see you in court · ';
const FONT = '500 16px "Cabinet Grotesk", sans-serif';
const CELL = 7;
const ROWS = 20;

export function mountMarquee(canvas: HTMLCanvasElement): () => void {
  const ac = new AbortController();
  const { signal } = ac;

  let dpr = 1;
  let tw = 0;
  let on: Uint8Array = new Uint8Array(0);
  let offsetX = 0;
  let raf = 0;
  let disposed = false;

  function build(): void {
    const w = canvas.clientWidth;
    if (!w) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = ROWS * CELL * dpr;
    canvas.style.height = `${ROWS * CELL}px`;

    const oc = document.createElement('canvas');
    let octx = oc.getContext('2d')!;
    octx.font = FONT;
    tw = Math.ceil(octx.measureText(TEXT).width) + 4;
    oc.width = tw;
    oc.height = ROWS;
    octx = oc.getContext('2d')!;
    octx.font = FONT;
    octx.textBaseline = 'middle';
    octx.fillStyle = PALETTE.navy;
    octx.fillText(TEXT, 0, ROWS / 2 + 1);

    const data = octx.getImageData(0, 0, tw, ROWS).data;
    on = new Uint8Array(tw * ROWS);
    for (let i = 0; i < on.length; i++) on[i] = data[i * 4 + 3]! > 150 ? 1 : 0;
    // 2 marks a right or bottom edge cell — those carry the navy outline.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < tw; x++) {
        const i = y * tw + x;
        if (!on[i]) continue;
        const rEdge = x + 1 >= tw || !on[i + 1];
        const bEdge = y + 1 >= ROWS || !on[i + tw];
        if (rEdge || bEdge) on[i] = 2;
      }
    }
  }

  function draw(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || !tw) return;
    const dark = isDark();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.clientWidth;
    const wCells = Math.ceil(w / CELL);
    ctx.clearRect(0, 0, w, ROWS * CELL);
    const off = Math.floor(offsetX);
    for (let x = 0; x < wCells; x++) {
      const sx = (x + off) % tw;
      for (let y = 0; y < ROWS; y++) {
        const v = on[y * tw + sx];
        if (!v) continue;
        if (v === 2) {
          ctx.fillStyle = navy(dark);
        } else {
          const hv = h(sx * 3 + 1, y * 7 + 2);
          ctx.fillStyle =
            hv > 0.97
              ? PALETTE.cobalt
              : hv > 0.88
                ? PALETTE.lime
                : hv > 0.72
                  ? PALETTE.red
                  : PALETTE.amber;
        }
        ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
      }
    }
  }

  function loop(): void {
    raf = requestAnimationFrame(loop);
    offsetX = (offsetX + 0.09) % tw;
    draw();
  }

  window.addEventListener(
    'resize',
    () => {
      build();
      draw();
    },
    { signal },
  );
  const unsubscribeTheme = onThemeChange(draw);
  if (document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      if (disposed) return;
      build();
      draw();
    });
  }

  build();
  draw();
  if (!prefersReducedMotion()) raf = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    ac.abort();
    unsubscribeTheme();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
