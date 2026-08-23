import { ReelField } from './reel-field';
import type { FieldPreset } from '@/lib/pixel/field';

/**
 * Case-study reels — one per work slug, two variants (ADR-0020):
 *
 * - `variant="card"`: `preset="tile"` — the home Work index is a matter-row
 *   stack now, so this size only survives on small surfaces.
 * - `variant="hero"`: `preset="band"` — the wide, short band at the top of a
 *   case-study detail page (`CaseStudyPage.tsx`, `CaseStudyStub.tsx`).
 *
 * Each reel renders the slug's own product source through the pixel field,
 * so the art repaints from theme tokens in light and dark mode instead of
 * shipping baked pixels on a fixed background. There is no video here any
 * more and no motion gate either: the field engine reads
 * `prefers-reduced-motion()` per frame and holds still on its own, which is
 * also what makes the reduced-motion e2e contract hold — a still field, not
 * an unrequested download.
 *
 * The name and the props are unchanged for the three call sites; see
 * ADR-0008 for the superseded HyperFrames pipeline this used to render.
 */

export type ReelSlug = 'neev' | 'vericite' | 'bluehost-agents' | 'curat-money' | 'clusterbid';

export const REEL_SLUGS: readonly ReelSlug[] = Object.keys(
  {
    neev: 1,
    vericite: 1,
    'bluehost-agents': 1,
    'curat-money': 1,
    clusterbid: 1,
  } as Record<ReelSlug, 1>,
) as ReelSlug[];

export function isReelSlug(slug: string): slug is ReelSlug {
  return (REEL_SLUGS as readonly string[]).includes(slug);
}

type ReelVariant = 'card' | 'hero';

/** Preset per variant. The hero band is a wide, short strip above the case
 * study; the card size is a squatter tile. Both read best on `band`, whose
 * cell/gain/noise tuning is built for exactly this aspect. */
const VARIANT_PRESET: Record<ReelVariant, FieldPreset> = {
  card: 'tile',
  hero: 'band',
};

/**
 * Reel — the case-study's own product source, mounted as a pixel field at
 * the variant's preset. Same interface the HyperFrames-era component had;
 * different pixels behind it.
 */
export function Reel({ slug, variant = 'hero' }: { slug: ReelSlug; variant?: ReelVariant }) {
  return (
    // A div rather than a figure: the call sites already wrap the reel in
    // their own media figure, and nesting two adds no semantics.
    <div className="px-reel" aria-hidden="true">
      <ReelField slug={slug} preset={VARIANT_PRESET[variant]} />
    </div>
  );
}