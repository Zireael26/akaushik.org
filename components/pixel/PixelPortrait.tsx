'use client';

import { useEffect, useRef, useState } from 'react';
import { mountField, type FieldHandle } from '@/lib/pixel/field';
import { fromImage, loadImage, seedFrom } from '@/lib/pixel/sources';

export type PixelPortraitProps = {
  src: string;
  /** Real alt text. A portrait carries meaning; it is not decoration. */
  alt: string;
  className?: string;
  /** Raises contrast by clipping the shadows. */
  floor?: number;
  /** <1 lifts midtones. Dark photographs usually want ~0.7. */
  gamma?: number;
  /**
   * Light up the dark parts instead of the bright ones. Set this when the
   * subject is darker than the ground it sits on — otherwise the background
   * lights and the subject drops out, which is exactly what happens to a person
   * photographed against a window.
   */
  invert?: boolean;
  cellSize?: number;
};

/**
 * A photograph, rendered as a living pixel field.
 *
 * The image is sampled into the cell grid, luminance becomes alpha, and from
 * there it is an ordinary field: the site's five-colour ramp applies, the
 * ambient drift plays over it, and the pointer paints heat into it. So a
 * photograph arrives already speaking the design's language instead of sitting
 * inside it as a foreign rectangle.
 *
 * Two things worth knowing before using this on another image. The grid is
 * coarse — a portrait at cellSize 4 is roughly 75 cells across — so faces
 * survive and fine detail does not; crop tight. And the source has to be
 * same-origin or CORS-enabled, because the field reads pixels back out of the
 * canvas and a tainted canvas throws on getImageData.
 *
 * Until the image loads there is nothing to draw, so the canvas stays blank
 * rather than showing a placeholder that would flash and be replaced. On a load
 * failure it stays blank too, and the alt text is what carries the meaning —
 * which is the same outcome a broken <img> would give, minus the broken icon.
 */
export function PixelPortrait({
  src,
  alt,
  className,
  floor = 0.06,
  gamma = 0.78,
  invert = false,
  cellSize = 4,
}: PixelPortraitProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let handle: FieldHandle | null = null;
    let cancelled = false;

    loadImage(src)
      .then((img) => {
        if (cancelled || !ref.current) return;
        handle = mountField(ref.current, {
          sources: [fromImage(img, { floor, gamma, invert, fit: 'cover' })],
          preset: 'tile',
          cellSize,
          interactive: true,
          seed: seedFrom(src),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, [src, floor, gamma, invert, cellSize]);

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label={failed ? `${alt} (image unavailable)` : alt}
    />
  );
}
