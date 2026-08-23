// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTE } from '../pixel';
import {
  CURSOR_SNAP_EASE,
  easeCursorPosition,
  isCloserCursorTarget,
  mountCursor,
} from './cursor';

type Fill = { x: number; y: number };

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}


describe('cursor target precedence', () => {
  it('uses DOM order to break equal-distance ties', () => {
    expect(isCloserCursorTarget({ distance: 4, index: 1 }, { distance: 4, index: 0 })).toBe(
      false,
    );
    expect(isCloserCursorTarget({ distance: 4, index: 0 }, { distance: 4, index: 1 })).toBe(
      true,
    );
  });
});

describe('cursor engine snap rendering', () => {
  let frames: FrameRequestCallback[];
  let fills: Fill[];
  let fillStyles: string[];
  let dispose: (() => void) | null;

  beforeEach(() => {
    frames = [];
    fills = [];
    fillStyles = [];
    dispose = null;

    const matchMedia = vi.fn((query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    }));
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    });

    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn((x: number, y: number) => {
        fills.push({ x, y });
      }),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(context, 'fillStyle', {
      configurable: true,
      set(value: string) {
        fillStyles.push(value);
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  });

  afterEach(() => {
    dispose?.();
    document.body.replaceChildren();
    document.documentElement.className = '';
    vi.restoreAllMocks();
  });

  function runFrame(timestamp: number): void {
    const callback = frames.shift();
    expect(callback).toBeDefined();
    callback?.(timestamp);
  }

  it('draws at the eased snap point without a velocity trail and resets on exit', () => {
    const target = document.createElement('div');
    target.dataset.pixelHover = '';
    target.getBoundingClientRect = () => makeRect(100, 100, 40, 40);
    document.body.append(target);

    const canvas = document.createElement('canvas');
    dispose = mountCursor(canvas);

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 0 }));
    runFrame(0);

    fills.length = 0;
    fillStyles.length = 0;
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 90 }));
    runFrame(16);
    expect(fills[0]?.x).toBe(102);
    expect(fillStyles).not.toContain(PALETTE.cobalt);
    expect(document.documentElement.classList.contains('px-cursor-active')).toBe(true);

    fills.length = 0;
    runFrame(32);
    expect(fills[0]?.x).toBe(106);

    document.documentElement.dispatchEvent(new Event('pointerleave'));
    expect(document.documentElement.classList.contains('px-cursor-active')).toBe(false);
    fills.length = 0;
    runFrame(48);
    expect(fills).toHaveLength(0);
  });

  it('anchors an overlap to the nearest hit target', () => {
    const first = document.createElement('div');
    first.dataset.pixelHover = '';
    first.getBoundingClientRect = () => makeRect(100, 100, 40, 40);
    const second = document.createElement('div');
    second.dataset.pixelHover = '';
    second.getBoundingClientRect = () => makeRect(80, 100, 40, 40);
    document.body.append(first, second);

    const canvas = document.createElement('canvas');
    dispose = mountCursor(canvas);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 95, clientY: 120 }));
    runFrame(0);

    fills.length = 0;
    runFrame(16);
    // The second target is nearest (distance 0 vs 5), so its x=126 anchor
    // eases the draw point to 101.2, which grid-snaps to 100 before the keycap.
    expect(fills[0]?.x).toBe(82);
  });
});
describe('cursor proximity snap', () => {
  it('eases exactly 0.2 toward the tile anchor and resets from the origin', () => {
    const origin = { x: 40, y: 80 };
    const target = { x: 140, y: 180 };

    expect(CURSOR_SNAP_EASE).toBe(0.2);
    expect(easeCursorPosition(null, target, origin)).toEqual(origin);

    const first = easeCursorPosition(origin, target, origin);
    expect(first).toEqual({ x: 60, y: 100 });

    const second = easeCursorPosition(first, target, origin);
    expect(second).toEqual({ x: 76, y: 116 });

    // Exit/disable paths pass null, which must discard the previous eased point.
    expect(easeCursorPosition(null, target, origin)).toEqual(origin);
  });
});
