'use client';

import { useEffect, useRef } from 'react';

/**
 * static decorative strip.
 *
 * STUB — the engine lands from the canvas-engine port (branch
 * feat/pixel-engines). The contract is fixed here so sections can import and
 * lay out against it now: a decorative canvas that fills its container and
 * takes no props. When the engine arrives, only the body of the effect changes.
 */
export function PixelBand() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return undefined;
  }, []);

  return <canvas ref={ref} className="px-pixel-band" aria-hidden="true" />;
}
