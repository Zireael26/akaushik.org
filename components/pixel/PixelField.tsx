'use client';

import { useEffect, useRef } from 'react';
import { mountField, type FieldHandle, type FieldPreset, type FieldSource } from '@/lib/pixel/field';

export type PixelFieldProps = {
  /** One entry per stage. A single source is a static field. */
  sources: readonly FieldSource[];
  preset?: FieldPreset;
  cellSize?: number;
  gain?: number;
  scatter?: number;
  shapeNoise?: number;
  /** Controlled stage. Changing it cross-fades. */
  stage?: number;
  interactive?: boolean;
  cycleOnClick?: boolean;
  swing?: boolean;
  ambient?: boolean;
  animate?: number;
  /** Per-instance hash offset — same seed, same texture, every load. */
  seed?: number;
  className?: string;
  /**
   * Decorative by default. Pass a label only when the field carries meaning the
   * surrounding copy does not already state; a duplicate label is worse than
   * none, because a screen reader then reads the same thing twice.
   */
  label?: string;
};

/**
 * The pixel field, as a React island: a ref, an effect, a disposer.
 *
 * `sources` is deliberately not in the effect's dependency array. Source arrays
 * are almost always built inline at the call site, so a new array identity
 * arrives on every render; depending on it would tear the field down and rebuild
 * the whole grid sixty times a second. The engine reads the array by reference
 * and the `stage` effect below drives the only thing that legitimately changes
 * after mount. If a caller genuinely needs to swap the source set, remount with
 * a `key`.
 */
export function PixelField({
  sources,
  preset = 'hero',
  cellSize,
  gain,
  scatter,
  shapeNoise,
  stage,
  interactive = false,
  cycleOnClick = false,
  swing = false,
  ambient = true,
  animate = 0,
  seed = 0,
  className,
  label,
}: PixelFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const handle = useRef<FieldHandle | null>(null);
  const sourcesRef = useRef(sources);

  // Kept fresh in an effect, not during render — writing a ref while rendering
  // is a tear in Strict/concurrent mode. The mount effect below only ever reads
  // the value captured at mount, which is the intended behaviour anyway.
  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const h = mountField(canvas, {
      sources: sourcesRef.current,
      preset,
      cellSize,
      gain,
      scatter,
      shapeNoise,
      interactive,
      cycleOnClick,
      swing,
      ambient,
      animate,
      seed,
    });
    handle.current = h;
    if (typeof stage === 'number') h.setStage(stage);
    return () => {
      h.dispose();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, cellSize, gain, scatter, shapeNoise, interactive, cycleOnClick, swing, ambient, animate, seed]);

  useEffect(() => {
    if (typeof stage === 'number') handle.current?.setStage(stage);
  }, [stage]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  );
}
