/**
 * The footer marquee — a ribbon of slogans sampled from type into pixel cells.
 *
 * Ported from gaurijha.com's src/scripts/marquee.ts (itself from _mkText/_drawMq
 * in the design-refs prototype). Glyphs are rasterised once from Cabinet Grotesk
 * 500 at 16px into a 20-row grid; every cell on the right or bottom edge of a
 * stroke is marked as an edge cell and drawn navy, and interior cells are
 * sprinkled from the palette. Base scroll is 0.09 cells/frame.
 *
 * Three deliberate changes from the source:
 *
 *   1. mountMarquee takes its canvas and returns a teardown, because under React
 *      the wrapper holds the ref and StrictMode mounts twice.
 *   2. It carries several slogans rather than one. They are rasterised into a
 *      single ribbon separated by middots, so "cycling" is just the scroll
 *      arriving at the next one — there is no swap, no cross-fade, and no state
 *      machine. A hard swap mid-scroll would jump the glyphs sideways.
 *   3. Each slogan gets its own dominant accent. The raster records which line
 *      every column belongs to, so the colour follows the words rather than the
 *      viewport.
 *
 * Interaction: hovering slows the ribbon to a crawl so a line can actually be
 * read, and clicking advances to the next slogan's start. Both are decorative
 * and both stop under prefers-reduced-motion, where the ribbon is static.
 */
import { PALETTE, h, navy, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

/**
 * Copy is his, drawn from docs/voice.md and the site's own sections. Editing
 * these is an editorial act, not a code change — keep them lowercase, short,
 * and free of the AI-tells voice.md bans.
 */
export const MARQUEE_LINES: readonly string[] = [
  'the loop is the thing',
  'receipts, not summaries',
  'none of this is clever',
  'built in the open',
  'agents that stay in production',
];

const SEPARATOR = '  ·  ';
const FONT = '500 16px "Cabinet Grotesk", sans-serif';
const CELL = 7;
const ROWS = 20;

/** Dominant accent per slogan, rotating. Edge cells stay navy regardless. */
const ACCENTS = [PALETTE.amber, PALETTE.cobalt, PALETTE.red, PALETTE.lime, PALETTE.amber] as const;

export type MarqueeOptions = {
  lines?: readonly string[];
};

export function mountMarquee(canvas: HTMLCanvasElement, options: MarqueeOptions = {}): () => void {
  const lines = options.lines?.length ? options.lines : MARQUEE_LINES;
  const ac = new AbortController();
  const { signal } = ac;

  let dpr = 1;
  let tw = 0;
  let on: Uint8Array = new Uint8Array(0);
  /** Which slogan each raster column belongs to; drives the accent. */
  let lineOf: Uint8Array = new Uint8Array(0);
  /** Raster x where each slogan begins, for click-to-advance. */
  let starts: number[] = [];
  let offsetX = 0;
  let speed = 0.09;
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
    const octx = oc.getContext('2d')!;
    octx.font = FONT;

    // Measure every slogan first so the ribbon can be laid out in one pass and
    // each column can be attributed to the line that drew it.
    const widths = lines.map((l) => Math.ceil(octx.measureText(l + SEPARATOR).width));
    tw = widths.reduce((a, b) => a + b, 0) + 4;

    oc.width = tw;
    oc.height = ROWS;
    const o = oc.getContext('2d')!;
    o.font = FONT;
    o.textBaseline = 'middle';
    o.fillStyle = '#fff';

    starts = [];
    let x = 0;
    lines.forEach((line, i) => {
      starts.push(x);
      o.fillText(line + SEPARATOR, x, ROWS / 2 + 1);
      x += widths[i]!;
    });

    const img = o.getImageData(0, 0, tw, ROWS).data;
    on = new Uint8Array(tw * ROWS);
    lineOf = new Uint8Array(tw);

    for (let col = 0; col < tw; col++) {
      // Attribute the column to the last slogan that started at or before it.
      let which = 0;
      for (let i = 0; i < starts.length; i++) if (col >= starts[i]!) which = i;
      lineOf[col] = which;
    }

    for (let y = 0; y < ROWS; y++) {
      for (let col = 0; col < tw; col++) {
        const i = y * tw + col;
        if (img[i * 4 + 3]! <= 128) continue;
        // Edge cells are the ones with nothing to their right or below — the
        // trick that gives the glyphs their weight without a second pass.
        const rightEmpty = col + 1 >= tw || img[(y * tw + col + 1) * 4 + 3]! <= 128;
        const belowEmpty = y + 1 >= ROWS || img[((y + 1) * tw + col) * 4 + 3]! <= 128;
        on[i] = rightEmpty || belowEmpty ? 2 : 1;
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
      const accent = ACCENTS[lineOf[sx]! % ACCENTS.length]!;
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
                  : accent;
        }
        ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
      }
    }
  }

  function loop(): void {
    raf = requestAnimationFrame(loop);
    if (!prefersReducedMotion()) offsetX = (offsetX + speed) % tw;
    draw();
  }

  canvas.addEventListener('pointerenter', () => { speed = 0.02; }, { signal });
  canvas.addEventListener('pointerleave', () => { speed = 0.09; }, { signal });

  canvas.addEventListener(
    'pointerdown',
    () => {
      if (!tw || starts.length < 2) return;
      // Jump to the next slogan's start, measured from what is currently at the
      // left edge of the viewport.
      const current = Math.floor(offsetX) % tw;
      const next = starts.find((s) => s > current) ?? starts[0]!;
      offsetX = next;
      draw();
    },
    { signal },
  );

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
  loop();

  return () => {
    disposed = true;
    ac.abort();
    unsubscribeTheme();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
