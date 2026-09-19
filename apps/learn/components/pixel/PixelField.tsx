'use client';

import { useEffect, useRef } from 'react';
import {
  mountField,
  type FieldColor,
  type FieldHandle,
  type FieldPreset,
  type FieldSource,
} from '@/lib/pixel/field';

export type PixelFieldProps = {
  sources: readonly FieldSource[];
  preset?: FieldPreset;
  color?: FieldColor;
  activeColor?: FieldColor;
  progress?: number;
  cellSize?: number;
  gain?: number;
  scatter?: number;
  shapeNoise?: number;
  stage?: number;
  interactive?: boolean;
  cycleOnClick?: boolean;
  swing?: boolean;
  ambient?: boolean;
  animate?: number;
  seed?: number;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
};

export function PixelField({
  sources,
  preset = 'hero',
  color,
  activeColor,
  progress,
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
  style,
}: PixelFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const handle = useRef<FieldHandle | null>(null);
  const sourcesRef = useRef(sources);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let h: FieldHandle | null = null;
    const rafId = requestAnimationFrame(() => {
      if (!canvas || canvas.offsetParent === null) return;
      h = mountField(canvas, {
        sources: sourcesRef.current,
        preset,
        color,
        activeColor,
        progress,
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
      if (typeof progress === 'number') h.setProgress(progress);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (h) h.dispose();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preset,
    color,
    activeColor,
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
  ]);

  useEffect(() => {
    if (typeof stage === 'number') handle.current?.setStage(stage);
  }, [stage]);

  useEffect(() => {
    if (typeof progress === 'number') handle.current?.setProgress(progress);
  }, [progress]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={style}
    />
  );
}
