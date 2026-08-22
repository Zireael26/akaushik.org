'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  /**
   * Which rectangle of the source to use, in 0..1. Almost every real
   * photograph needs one — see `fromImage`.
   */
  crop?: { x: number; y: number; w: number; h: number };
};

/**
 * A photograph, rendered as a living pixel field — and clickable, to see the
 * photograph underneath.
 *
 * The image is sampled into the cell grid, luminance becomes alpha, and from
 * there it is an ordinary field: the site's five-colour ramp applies, the
 * ambient drift plays over it, and the pointer paints heat into it. So a
 * photograph arrives already speaking the design's language instead of sitting
 * inside it as a foreign rectangle.
 *
 * Clicking swaps to the real photograph and back. Both layers are always in the
 * DOM and cross-fade on opacity, because mounting and tearing down the field on
 * every toggle would re-run the whole grid build and the luminance stretch for
 * what should feel instant. The field keeps running underneath while the photo
 * is showing; it is one rAF loop over a small grid, and stopping it would cost a
 * rebuild on the way back.
 *
 * Two things worth knowing before using this on another image. The grid is
 * coarse — a portrait at cellSize 4 is roughly 75 cells across — so faces
 * survive and fine detail does not; crop tight. And the source has to be
 * same-origin or CORS-enabled, because the field reads pixels back out of the
 * canvas and a tainted canvas throws on getImageData.
 */
export function PixelPortrait({
  src,
  alt,
  className,
  floor = 0.06,
  gamma = 0.78,
  invert = false,
  cellSize = 4,
  crop,
}: PixelPortraitProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let handle: FieldHandle | null = null;
    let cancelled = false;

    loadImage(src)
      .then((img) => {
        if (cancelled || !ref.current) return;
        handle = mountField(ref.current, {
          sources: [fromImage(img, { floor, gamma, invert, crop, fit: 'cover' })],
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

  const toggle = useCallback(() => setShowPhoto((v) => !v), []);

  // If the image never loaded there is nothing to toggle to, so the control
  // collapses to a plain labelled canvas rather than a button that does nothing.
  if (failed) {
    return (
      <canvas ref={ref} className={className} role="img" aria-label={`${alt} (image unavailable)`} />
    );
  }

  return (
    <button
      type="button"
      className={`px-portrait-toggle${showPhoto ? ' is-photo' : ''}`}
      onClick={toggle}
      aria-pressed={showPhoto}
      aria-label={
        showPhoto ? `${alt}. Showing the photograph — activate for pixel art.` : `${alt}. Showing pixel art — activate for the photograph.`
      }
    >
      <canvas ref={ref} className={className} aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="px-portrait-photo" src={src} alt="" aria-hidden="true" />
    </button>
  );
}
