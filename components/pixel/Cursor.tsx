'use client';

import { useEffect, useRef } from 'react';
import { mountCursor } from '@/lib/scenes/cursor';

/**
 * The decorative full-viewport pixel cursor.
 *
 * The engine owns drawing, media gates, listeners and native-cursor restoration;
 * this component owns only the canvas ref and React teardown boundary.
 */
export function Cursor() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return mountCursor(canvas);
  }, []);

  return <canvas ref={ref} className="px-cursor" aria-hidden="true" />;
}
