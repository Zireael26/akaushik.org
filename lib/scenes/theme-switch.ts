/**
 * The pixel theme switch — 52x26 outlined track, amber sun sliding to a lime moon.
 *
 * Ported from gaurijha.com's src/scripts/theme-switch.ts (tag public-site-v1):
 * the 13x5 cell track at C=4, the two glyph tables, the 0.22 knob lerp, the 0.5
 * crossover and the fixed 2x transform are the prototype's, unchanged.
 *
 * Three deliberate changes from the source, all forced by this codebase:
 *
 *   1. mountThemeSwitch takes its canvas and returns a teardown. The original
 *      queried `[data-gj-theme-switch]` once for the lifetime of the document
 *      and never cleaned up; under React that leaks listeners and a theme
 *      subscription on every remount, and StrictMode mounts twice. Listeners go
 *      through an AbortController and the caller gets a disposer.
 *   2. Theme state routes through html[data-mode], not body.gj-dark — that is
 *     the attribute public/init-theme.js and components/pixel/ThemeSwitch.tsx
 *     already write — and clicks persist to the site's storage key,
 *     abhishek.portfolio.mode. The source's own toggleTheme()/Set-of-listeners
 *     mechanism does not exist here; onThemeChange watches the attribute.
 *   3. The enclosing button is derived from the passed canvas via closest(),
 *     never re-queried from the document. If it is missing the engine fails
 *     quiet with a no-op disposer rather than throwing.
 *
 * The prototype redraws this every frame from the page's single rAF. An island
 * with its own loop would spin forever for a widget that is static most of the
 * time, so the loop here still runs only while the knob is in flight.
 */
import { PALETTE, inkAlpha, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

/** Cell size inside the 52x26 track. */
const C = 4;
const COLS = 13;
const ROWS = 5;

const SUN: ReadonlyArray<readonly [number, number]> = [
  [2, 0],
  [0, 2],
  [4, 2],
  [2, 4],
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
  [2, 2],
  [3, 2],
  [1, 3],
  [2, 3],
  [3, 3],
];

const MOON: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [2, 0],
  [3, 0],
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 4],
  [2, 4],
  [3, 4],
];

/** The storage key public/init-theme.js reads and ThemeSwitch writes. */
const MODE_KEY = 'abhishek.portfolio.mode';

/** The source's toggleTheme(), rewritten for html[data-mode]. */
function toggleMode(): void {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-mode', next);
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {
    /* private browsing — the attribute still applied, only persistence is lost */
  }
}

export function mountThemeSwitch(canvas: HTMLCanvasElement): () => void {
  const button = canvas.closest<HTMLButtonElement>('button');
  const ctx = canvas.getContext('2d');
  if (!button || !ctx) return () => {};

  // The buffer is 104x52 at a fixed 2x transform, as in the prototype.
  ctx.setTransform(2, 0, 0, 2, 0, 0);

  /** Knob position, 0 = sun/left, 1 = moon/right. Null until the first draw. */
  let p: number | null = null;
  let raf = 0;
  const ac = new AbortController();

  function draw(): void {
    const dark = isDark();
    const target = dark ? 1 : 0;

    if (p === null || prefersReducedMotion()) {
      p = target;
    } else {
      p += (target - p) * 0.22;
    }

    ctx!.clearRect(0, 0, 52, 26);

    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        // The four corners stay open — that is what reads as a rounded track.
        if ((x === 0 || x === COLS - 1) && (y === 0 || y === ROWS - 1)) continue;
        const edge = x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1;
        ctx!.fillStyle = edge
          ? inkAlpha(dark ? 0.5 : 0.42, dark)
          : inkAlpha(dark ? 0.14 : 0.08, dark);
        ctx!.fillRect(x * C, (y + 0.5) * C, C - 1, C - 1);
      }
    }

    // The glyph flips at the halfway point, so the sun never reaches the right end.
    const showMoon = p > 0.5;
    ctx!.fillStyle = showMoon ? PALETTE.lime : PALETTE.amber;
    const kx = 2 + p * 28;
    for (const [gx, gy] of showMoon ? MOON : SUN) {
      ctx!.fillRect(kx + gx * C, (gy + 0.5) * C + 1, C - 1, C - 1);
    }
  }

  function settled(): boolean {
    const target = isDark() ? 1 : 0;
    return p !== null && Math.abs(target - p) < 0.001;
  }

  function loop(): void {
    draw();
    if (settled()) {
      // Land exactly on the target so a stopped knob never sits a fraction short.
      p = isDark() ? 1 : 0;
      draw();
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function run(): void {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  button.addEventListener(
    'click',
    () => {
      toggleMode();
    },
    { signal: ac.signal },
  );

  const unsubscribeTheme = onThemeChange((dark) => {
    run();
    button.setAttribute('aria-pressed', String(dark));
  });

  draw();
  button.setAttribute('aria-pressed', String(isDark()));

  return () => {
    ac.abort();
    unsubscribeTheme();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
