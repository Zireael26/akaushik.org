- 2026-08-23 — U2, the reels come out (ADR-0020). `components/work/reels.tsx` keeps its name,
  exports (`ReelSlug`, `REEL_SLUGS`, `isReelSlug`) and all three call sites, but renders the
  case study's own product source (`lib/pixel/products.ts` via new
  `components/work/reel-field.tsx`) as a pixel field instead of an SVG floor under a
  HyperFrames MP4: `variant="hero"` → engine `band` preset, `variant="card"` → `tile`. The Neev
  detail-page special case (`HyperframesLoop kind="work-inline"`) collapses into the same `Reel`
  path. Reel band styling moved to `app/styles/sections/reel.css`; the video/SVG-floor rules in
  `app/styles/sections/work-detail.css` are gone with their selectors. Reduced-motion contract
  now asserted on fields: the two video specs in `e2e/reduced-motion.spec.ts` are rewritten as a
  zero-media-bytes navigation check and reel stillness via canvas sampling, plus an animating
  control; `e2e/work.spec.ts`'s ClusterBid spec drops the deleted `svg[data-reel-slug]` /
  `video[data-slug]` assertions for the field locator. ADR-0020 records the supersession.
  HyperFrames assets/automation are unconsumed on this path and reported for deletion votes,
  not deleted. No files removed.
