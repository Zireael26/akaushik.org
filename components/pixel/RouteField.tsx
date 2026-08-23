'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { productSource } from '@/lib/pixel/products';
import { seedFrom, trellis } from '@/lib/pixel/sources';
import { topicSource, type WritingArt } from '@/lib/pixel/topics';

export type RouteFieldProps = {
  slug: string;
  /** Writing topic art, from frontmatter. Case studies ignore it and use their product source. */
  art?: WritingArt;
};

/**
 * The shared decorative route strip for writing and case-study detail
 * surfaces.
 *
 * A case study's art is its product: the slug resolves through U1's
 * `productSource`. A writing post's art is its topic: frontmatter declares one
 * member of the closed vocabulary in `lib/pixel/topics.ts` and it resolves
 * through `topicSource`. Anything that resolves to no source — an absent or
 * unknown topic on a post the bundle build has already warned about — falls
 * back to the trellis strip, still varied by the slug seed.
 *
 * Every path keeps the seed, so two posts sharing a topic share a composition,
 * never a texture.
 */
export function RouteField({ slug, art }: RouteFieldProps) {
  const source = productSource(slug) ?? topicSource(art) ?? trellis;
  return (
    <PixelField
      className="px-route-field"
      sources={[source]}
      preset="strip"
      seed={seedFrom(slug)}
    />
  );
}
