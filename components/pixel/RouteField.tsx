'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { seedFrom, trellis } from '@/lib/pixel/sources';

export type RouteFieldProps = {
  slug: string;
};

/**
 * A shared decorative route strip for writing and case-study detail surfaces.
 *
 * The current frontmatter vocabulary has no clean topic mapping, so every
 * route uses the same restrained trellis source and varies only by its slug
 * seed.
 */
export function RouteField({ slug }: RouteFieldProps) {
  return (
    <PixelField
      className="px-route-field"
      sources={[trellis]}
      preset="strip"
      seed={seedFrom(slug)}
    />
  );
}
