// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RIGHT } from '../arcade/game';
import { mountArcade, type ArcadeHandle } from './arcade';

type PendingFrame = Readonly<{ id: number; callback: FrameRequestCallback }>;

function canvasRect(width: number, height: number): DOMRect {
  const rect = {
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
  return rect;
}

describe('arcade scene lifecycle', () => {
  let handle: ArcadeHandle | null;
  let pendingFrames: PendingFrame[];
  let nextFrameId: number;
  let cancelledFrames: number[];
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    handle = null;
    pendingFrames = [];
    nextFrameId = 1;
    cancelledFrames = [];
    localStorage.clear();
    document.documentElement.setAttribute('data-mode', 'light');
    document.documentElement.setAttribute('data-motion', 'on');

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => {
        const mediaQuery = {
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(() => true),
        } as unknown as MediaQueryList;
        return mediaQuery;
      }),
    });

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId++;
        pendingFrames.push({ id, callback });
        return id;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => {
        cancelledFrames.push(id);
        pendingFrames = pendingFrames.filter((frame) => frame.id !== id);
      }),
    );

    const context = {
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.getBoundingClientRect = () => canvasRect(500, 340);
    document.body.append(canvas);
  });

  afterEach(() => {
    handle?.dispose();
    document.body.replaceChildren();
    document.documentElement.removeAttribute('data-mode');
    document.documentElement.removeAttribute('data-motion');
    vi.restoreAllMocks();
  });

  function runFrame(timestamp: number): void {
    const frame = pendingFrames.shift();
    expect(frame).toBeDefined();
    frame?.callback(timestamp);
  }

  it('owns at most one frame and cancels it across dispose and remount', () => {
    handle = mountArcade(canvas);
    expect(pendingFrames).toHaveLength(0);

    expect(handle.start()).toBe(true);
    expect(pendingFrames).toHaveLength(1);
    expect(handle.start()).toBe(false);
    handle.input(RIGHT);
    handle.input(RIGHT);
    expect(pendingFrames).toHaveLength(1);

    runFrame(16);
    expect(pendingFrames).toHaveLength(1);

    handle.dispose();
    expect(pendingFrames).toHaveLength(0);
    expect(cancelledFrames).toContain(2);
    expect(handle.input(RIGHT)).toBe(false);

    handle = mountArcade(canvas);
    expect(handle.start()).toBe(true);
    expect(pendingFrames).toHaveLength(1);
    handle.dispose();
    expect(pendingFrames).toHaveLength(0);
  });

  it('runs one snapped turn per non-repeated key while motion is vetoed', () => {
    document.documentElement.setAttribute('data-motion', 'off');
    handle = mountArcade(canvas);
    expect(handle.start()).toBe(true);
    expect(pendingFrames).toHaveLength(0);

    canvas.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(handle.snapshot()).toMatchObject({ score: 10, readingsRemaining: 198 });
    expect(pendingFrames).toHaveLength(0);

    canvas.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(handle.snapshot()).toMatchObject({ score: 10, readingsRemaining: 198 });
    expect(pendingFrames).toHaveLength(0);
  });
});
