'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { seedFrom, trellis } from '@/lib/pixel/sources';
import { topicSource, type WritingArt } from '@/lib/pixel/topics';
import type { FieldPreset } from '@/lib/pixel/field';

export type RouteFieldProps = {
  slug: string;
  /** Writing topic art, from frontmatter. */
  art?: WritingArt;
  /**
   * `strip` is the thin index-style texture; `hero` is the article band.
   * The writing detail template mounts `hero` — the operator retired the
   * letterbox strip (ADR-0020's successor note).
   */
  variant?: 'strip' | 'hero';
};

const VARIANT_PRESET: Record<NonNullable<RouteFieldProps['variant']>, FieldPreset> = {
  strip: 'strip',
  hero: 'hero',
};

/**
 * The writing detail route's piece of art.
 *
 * Frontmatter declares one member of the closed vocabulary in
 * `lib/pixel/topics.ts`, resolved through `topicSource`. An absent topic that
 * the bundle build has already warned about falls back to the trellis strip,
 * still varied by the slug seed.
 *
 * Every path keeps the seed, so two posts sharing a topic share a composition,
 * never a texture. `variant="hero"` also steps the geometry on the engine's
 * cheap cadence (`animate: 3`), the same contract a case-study `ReelField`
 * carries; under reduced motion the engine stops stepping entirely.
 */
export function RouteField({ slug, art, variant = 'strip' }: RouteFieldProps) {
  const source = topicSource(art) ?? trellis;
  const hero = variant === 'hero';
  return (
    <PixelField
      className={hero ? 'px-route-field is-hero' : 'px-route-field'}
      sources={[source]}
      preset={VARIANT_PRESET[variant]}
      seed={seedFrom(slug)}
      animate={hero ? 3 : 0}
    />
  );
}
