'use client';

import { useEffect, useRef } from 'react';
import { mountThemeSwitch } from '@/lib/scenes/theme-switch';

/**
 * The pixel theme switch button.
 *
 * Same island shape as Heatfield: a ref, an effect, a disposer. This one owns a
 * real <button> because the switch is interactive — the engine derives it from
 * the canvas via closest() and manages click, persistence and aria-pressed.
 *
 * Decorative canvas: aria-hidden. Global :focus-visible styles already supply
 * the visible focus ring on the button.
 */
export function ThemeSwitch() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return mountThemeSwitch(canvas);
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
