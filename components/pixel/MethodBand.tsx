'use client';

import { useEffect, useRef } from 'react';
import { mountMethodBand } from '@/lib/scenes/method-band';

/**
 * The method flow band canvas.
 *
 * Same surface as every pixel island: a ref, an effect, a disposer. The engine
 * owns its loop, listeners and theme subscription and hands back a teardown,
 * which makes StrictMode's double-mount a no-op rather than two competing rAF
 * loops.
 *
 * Decorative: aria-hidden. Under prefers-reduced-motion the engine draws one
 * static frame and re-themes it via its subscription.
 */
export function MethodBand() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return mountMethodBand(canvas);
  }, []);

  return <canvas ref={ref} className="px-method-band" aria-hidden="true" />;
}
