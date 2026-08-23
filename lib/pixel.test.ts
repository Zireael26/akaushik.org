// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PALETTE,
  canvasBg,
  cellRect,
  deepBlue,
  fitCanvas,
  h,
  inkAlpha,
  isFinePointer,
  navy,
  prefersReducedMotion,
} from './pixel';

/**
 * The primitives every canvas island draws through.
 *
 * `prefersReducedMotion` is the reason this file exists. It reads two
 * independent sources and either one is a veto — and it did not always: the
 * site's own motion switch was ignored here, so turning motion off stopped the
 * videos and left every canvas still drifting. A switch that reaches half the
 * motion is worse than no switch, because the user believes they have handled
 * it. Nothing failed when that was broken, so it gets explicit cases for both
 * sources and for each one alone.
 */

function setMatchMedia(matches: (query: string) => boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: matches(query),
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-motion');
});

describe('h', () => {
  it('is deterministic — the art must be identical on every load', () => {
    expect(h(3, 7)).toBe(h(3, 7));
    expect(h(0, 0)).toBe(h(0, 0));
  });

  it('stays in [0, 1)', () => {
    for (let x = 0; x < 40; x += 1) {
      for (let y = 0; y < 40; y += 7) {
        const v = h(x, y);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('varies with both coordinates', () => {
    expect(h(1, 2)).not.toBe(h(2, 1));
    expect(h(5, 5)).not.toBe(h(5, 6));
  });

  it('spreads across the range rather than clustering', () => {
    // A hash that returned a near-constant would satisfy every check above and
    // make every field look like flat noise.
    const values = Array.from({ length: 200 }, (_, i) => h(i, i * 3));
    const buckets = new Set(values.map((v) => Math.floor(v * 10)));
    expect(buckets.size).toBeGreaterThan(7);
  });
});

describe('the palette', () => {
  it('is six-digit hex, matching tokens.css', () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      expect(value, `${name} is not a hex colour`).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it.each([
    ['navy', navy],
    ['deepBlue', deepBlue],
    ['canvasBg', canvasBg],
  ])('%s returns a different colour per theme', (_name, fn) => {
    expect(fn(true)).not.toBe(fn(false));
    expect(fn(true)).toMatch(/^#[0-9A-F]{6}$/i);
    expect(fn(false)).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('canvasBg is white on light and near-black on dark, not the reverse', () => {
    expect(canvasBg(false)).toBe('#FFFFFF');
    expect(canvasBg(true)).toBe('#0F1218');
  });
});

describe('inkAlpha', () => {
  it('carries the alpha through', () => {
    expect(inkAlpha(0.42, false)).toContain('0.42');
  });

  it('uses a dark ink on light and a light ink on dark', () => {
    // Inverting these makes every canvas invisible against its own background,
    // which is exactly the bug an eye catches instantly and a type-check never.
    expect(inkAlpha(1, false)).toBe('rgba(17, 19, 24, 1)');
    expect(inkAlpha(1, true)).toBe('rgba(239, 241, 246, 1)');
  });
});

describe('cellRect', () => {
  it('draws a cell with a one-pixel gutter at the scaled position', () => {
    const fillRect = vi.fn();
    cellRect({ fillRect } as unknown as CanvasRenderingContext2D, 3, 4, 5);
    expect(fillRect).toHaveBeenCalledWith(15, 20, 4, 4);
  });
});

describe('fitCanvas', () => {
  it('sizes the backing store by devicePixelRatio and scales the context', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const setTransform = vi.fn();
    const el = {
      width: 0,
      height: 0,
      style: {} as CSSStyleDeclaration,
      getContext: () => ({ setTransform }),
    } as unknown as HTMLCanvasElement;

    fitCanvas(el, 100, 50);

    expect(el.width).toBe(200);
    expect(el.height).toBe(100);
    expect(el.style.height).toBe('50px');
    expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  /**
   * The cap is a performance decision, not an aesthetic one: a 3x backing store
   * is 2.25x the pixels of a 2x one, every frame, for no visible gain on the
   * fields this site draws.
   */
  it('caps the ratio at 2 on a higher-density display', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const el = {
      width: 0,
      height: 0,
      style: {} as CSSStyleDeclaration,
      getContext: () => ({ setTransform() {} }),
    } as unknown as HTMLCanvasElement;

    fitCanvas(el, 100, 50);
    expect(el.width).toBe(200);
  });

  it('falls back to 1 when devicePixelRatio is unavailable', () => {
    vi.stubGlobal('devicePixelRatio', 0);
    const el = {
      width: 0,
      height: 0,
      style: {} as CSSStyleDeclaration,
      getContext: () => ({ setTransform() {} }),
    } as unknown as HTMLCanvasElement;

    fitCanvas(el, 100, 50);
    expect(el.width).toBe(100);
  });
});

describe('prefersReducedMotion', () => {
  it('is false when neither source objects', () => {
    setMatchMedia(() => false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('honours the OS preference', () => {
    setMatchMedia((q) => q.includes('prefers-reduced-motion'));
    expect(prefersReducedMotion()).toBe(true);
  });

  /**
   * The regression this file was written for. The site switch alone must stop
   * motion even when the OS has no preference — that was the broken case, and
   * the symptom was canvases that kept drifting after the user turned motion
   * off.
   */
  it('honours the site switch on its own, with no OS preference', () => {
    setMatchMedia(() => false);
    document.documentElement.setAttribute('data-motion', 'off');
    expect(prefersReducedMotion()).toBe(true);
  });

  it('does not consult matchMedia once the site switch says no', () => {
    const matchMedia = vi.fn(() => ({ matches: false }) as unknown as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);
    document.documentElement.setAttribute('data-motion', 'off');

    expect(prefersReducedMotion()).toBe(true);
    // Called per frame, so the early return is the point, not an accident.
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it('treats any data-motion value other than "off" as motion allowed', () => {
    setMatchMedia(() => false);
    for (const value of ['on', '', 'OFF', 'reduce']) {
      document.documentElement.setAttribute('data-motion', value);
      expect(prefersReducedMotion(), `"${value}" should not stop motion`).toBe(false);
    }
  });
});

describe('isFinePointer', () => {
  it('is true for a mouse and false for touch', () => {
    setMatchMedia((q) => q.includes('pointer: fine'));
    expect(isFinePointer()).toBe(true);

    setMatchMedia(() => false);
    expect(isFinePointer()).toBe(false);
  });

  it('asks about pointer, not about hover', () => {
    const matchMedia = vi.fn(() => ({ matches: true }) as unknown as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);
    isFinePointer();
    expect(matchMedia).toHaveBeenCalledWith('(pointer: fine)');
  });
});
