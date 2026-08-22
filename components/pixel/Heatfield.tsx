'use client';

import { useEffect, useRef } from 'react';
import { mountHeatfield } from '@/lib/scenes/heatfield';

/**
 * The heatfield hero canvas.
 *
 * This is the whole React surface of a pixel island: a ref, an effect, a
 * disposer. The engine owns its own loop, listeners and theme subscription and
 * hands back a teardown — which is what makes StrictMode's double-mount in dev
 * a no-op rather than two competing rAF loops.
 *
 * Decorative: aria-hidden, and the engine already no-ops its motion paths under
 * prefers-reduced-motion.
 */
export function Heatfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return mountHeatfield(canvas);
  }, []);

  return (
    <div className="px-heatfield">
      <canvas ref={ref} aria-hidden="true" />
    </div>
  );
}
