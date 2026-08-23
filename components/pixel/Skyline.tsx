'use client';

import { useEffect, useRef } from 'react';
import { mountSkyline } from '@/lib/scenes/skyline';

/**
 * The Delhi legal skyline footer canvas.
 *
 * Same pixel-island shape as Heatfield: a ref, an effect, a disposer. The
 * engine owns its own listeners and theme subscription and hands back a
 * teardown, so StrictMode's double-mount in dev is a no-op rather than two
 * competing resize/theme rebuilders.
 *
 * Decorative: aria-hidden.
 */
export function Skyline() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return mountSkyline(canvas);
  }, []);

  return <canvas ref={ref} className="px-skyline" aria-hidden="true" />;
}
