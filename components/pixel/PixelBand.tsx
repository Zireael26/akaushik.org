'use client';

import { useEffect, useRef } from 'react';
import { mountPixelBand } from '@/lib/scenes/pixel-band';

/**
 * The static pixel band canvas.
 *
 * Same React surface as every pixel island: a ref, an effect, a disposer. The
 * engine owns its listeners and theme subscription and hands back a teardown,
 * which is what makes StrictMode's double-mount in dev a no-op rather than two
 * competing rebuilds.
 *
 * Decorative: aria-hidden. Static by design — no loop to gate behind
 * prefers-reduced-motion.
 */
export function PixelBand() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return mountPixelBand(canvas);
  }, []);

  return <canvas ref={ref} className="px-pixel-band" aria-hidden="true" />;
}
