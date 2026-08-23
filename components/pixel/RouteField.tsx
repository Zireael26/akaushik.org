'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { seedFrom, trellis } from '@/lib/pixel/sources';
import { topicSource, type WritingArt } from '@/lib/pixel/topics';

export type RouteFieldProps = {
  slug: string;
  /** Writing topic art, from frontmatter. */
  art?: WritingArt;
};

/**
 * The decorative strip for writing detail routes.
 *
 * Frontmatter declares one member of the closed vocabulary in
 * `lib/pixel/topics.ts`, resolved through `topicSource`. An absent topic that
 * the bundle build has already warned about falls back to the trellis strip,
 * still varied by the slug seed.
 *
 * Every path keeps the seed, so two posts sharing a topic share a composition,
 * never a texture.
 */
export function RouteField({ slug, art }: RouteFieldProps) {
  const source = topicSource(art) ?? trellis;
  return (
    <PixelField
      className="px-route-field"
      sources={[source]}
      preset="strip"
      seed={seedFrom(slug)}
    />
  );
}
