'use client';

import { PixelField } from '@/components/pixel/PixelField';
import type { FieldPreset } from '@/lib/pixel/field';
import { productSource } from '@/lib/pixel/products';
import { seedFrom } from '@/lib/pixel/sources';
import type { ReelSlug } from './reels';

export type ReelFieldProps = {
  slug: ReelSlug;
  preset: FieldPreset;
};

/**
 * The pixel field behind a case-study reel (ADR-0020).
 *
 * The art is the slug's own product source from `lib/pixel/products.ts` —
 * the lookup is keyed by slug precisely so a reel cannot be wired to the
 * wrong (or someone else's, or everyone's-the-same) source. The seed comes
 * from the slug too, so a given reel has the same texture on every load,
 * matching the house rule for per-page art.
 *
 * `animate: 3` lets animated product sources step their geometry on the
 * cheap cadence; under reduced motion the engine stops stepping entirely,
 * so the same mount holds still without a second gate here.
 */
export function ReelField({ slug, preset }: ReelFieldProps) {
  return (
    <PixelField
      className="px-reel-field"
      sources={[productSource(slug)!]}
      preset={preset}
      seed={seedFrom(slug)}
      animate={3}
    />
  );
}
