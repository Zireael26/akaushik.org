'use client';

import { useEffect, useRef } from 'react';
import { mountThemeSwitch } from '@/lib/pixel/theme-switch';

export function ThemeSwitch() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const disposer = mountThemeSwitch(canvas);
    return () => {
      disposer();
    };
  }, []);

  return (
    <button
      type="button"
      className="px-theme-switch"
      aria-label="Switch between day and night"
      style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0 }}
    >
      <canvas
        ref={ref}
        aria-hidden="true"
        width={104}
        height={52}
        style={{ display: 'block', width: 52, height: 26 }}
      />
    </button>
  );
}
