'use client';

import { useEffect, useRef } from 'react';
import { mountMarquee } from '@/lib/scenes/marquee';

/**
 * The footer marquee canvas — "see you in court · " scrolled as pixel cells.
 *
 * This is the whole React surface of a pixel island: a ref, an effect, a
 * disposer. The engine owns its own loop, listener and theme subscription and
 * hands back a teardown — which is what makes StrictMode's double-mount in dev
 * a no-op rather than two competing rAF loops.
 *
 * Decorative: aria-hidden, and the engine already no-ops its scroll under
 * prefers-reduced-motion.
 */
export function Marquee() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return mountMarquee(canvas);
  }, []);

  return <canvas ref={ref} className="px-marquee" aria-hidden="true" />;
}
