/**
 * A recording stand-in for `CanvasRenderingContext2D`, for testing sources.
 *
 * A `FieldSource` returns nothing. Its entire output is the sequence of calls
 * it makes on the context it was handed, so that sequence is the only thing
 * there is to assert on — hence a recorder rather than a mock. Every drawing
 * call is appended to `calls` with its arguments, and the geometry-bearing ones
 * additionally push to `points`, which is what makes "did this stay inside the
 * grid" a one-line assertion instead of a parse of the call log.
 *
 * Not a jsdom canvas. jsdom's 2D context is a no-op unless the optional `canvas`
 * native package is installed, so a test written against it passes whether or
 * not the source draws anything — which is the failure mode this file exists to
 * avoid. Here an empty `calls` array is unambiguous: the source drew nothing.
 *
 * Test-only, but it lives in `lib/` rather than beside one test because
 * `sources.ts`, `stages.ts` and `neural.ts` all need it, and a copy per file is
 * three things to keep in step.
 */

export type RecordedCall = { fn: string; args: readonly unknown[] };

export type StubContext = CanvasRenderingContext2D & {
  calls: RecordedCall[];
  /** Every (x, y) passed to a positional drawing call. */
  points: Array<[number, number]>;
  /** `fn:args` per call, joined — a cheap identity for the whole drawing. */
  signature(): string;
  reset(): void;
};

/** Calls whose first two arguments are a coordinate in grid space. */
const POSITIONAL = new Set(['moveTo', 'lineTo', 'fillRect', 'strokeRect', 'rect', 'arc', 'fillText']);

const NO_OP = [
  'beginPath', 'closePath', 'stroke', 'fill', 'save', 'restore', 'clip',
  'translate', 'rotate', 'scale', 'setTransform', 'resetTransform',
  'quadraticCurveTo', 'bezierCurveTo', 'ellipse', 'clearRect', 'drawImage',
  'setLineDash', 'putImageData', 'strokeText', 'roundRect', 'arcTo',
] as const;

export function createStubContext(): StubContext {
  const calls: RecordedCall[] = [];
  const points: Array<[number, number]> = [];

  const record = (fn: string) => (...args: unknown[]) => {
    calls.push({ fn, args });
    if (POSITIONAL.has(fn) && typeof args[0] === 'number' && typeof args[1] === 'number') {
      points.push([args[0], args[1]]);
    }
  };

  const ctx: Record<string, unknown> = {
    calls,
    points,
    signature: () =>
      calls
        .map((c) => `${c.fn}(${c.args.map((a) => (typeof a === 'number' ? a.toFixed(4) : String(a))).join(',')})`)
        .join('|'),
    reset: () => {
      calls.length = 0;
      points.length = 0;
    },
  };

  for (const fn of [...NO_OP, ...POSITIONAL]) ctx[fn] = record(fn);

  // Style properties are assigned, not called. They are recorded too, because a
  // source that sets `lineWidth` per element is expressing geometry through it.
  for (const prop of ['lineWidth', 'globalAlpha', 'shadowBlur', 'font', 'lineCap', 'lineJoin', 'textAlign', 'textBaseline', 'fillStyle', 'strokeStyle', 'globalCompositeOperation', 'shadowColor', 'miterLimit']) {
    let value: unknown = prop === 'lineWidth' ? 1 : '';
    Object.defineProperty(ctx, prop, {
      get: () => value,
      set: (v: unknown) => {
        value = v;
        calls.push({ fn: `set:${prop}`, args: [v] });
      },
      enumerable: true,
      configurable: true,
    });
  }

  // `fromImage` reads pixels back. Returning opaque mid-grey keeps its
  // luminance maths on a real number rather than NaN.
  ctx.getImageData = (_x: number, _y: number, w: number, h: number) => {
    calls.push({ fn: 'getImageData', args: [_x, _y, w, h] });
    return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)).fill(128), width: w, height: h };
  };
  ctx.createImageData = (w: number, h: number) => ({
    data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
    width: w,
    height: h,
  });
  ctx.measureText = (text: string) => ({ width: text.length * 6 });
  ctx.canvas = { width: 0, height: 0 };

  return ctx as unknown as StubContext;
}
