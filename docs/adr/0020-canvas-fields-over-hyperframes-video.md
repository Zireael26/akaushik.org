# ADR-0020 — Case-study motion moves from rendered video to canvas fields

**Status:** Accepted, 2026-08-23. Supersedes ADR-0008 in part — the case-study reel half. The writing-post loop pipeline (ADR-0011) is unchanged by this decision and is tracked separately.

## Context

ADR-0008 adopted HeyGen's HyperFrames HTML-to-video pipeline for case-study reels: eight compositions under `scripts/hyperframes/`, rendered to `public/video/work/<slug>[-hero].mp4` + `.webp` posters, layered over a static SVG floor by `components/work/reels.tsx`, gated for reduced motion by `components/media/MotionVideo.tsx`.

The pixel-art pass replaced the site's visual system with canvas fields that repaint from theme tokens (`lib/pixel/*`). Against that system the baked-pixel videos fail on three counts:

1. **Theme responsiveness.** An MP4 is pixels on a fixed background. It cannot follow light/dark mode or any future token change, so it reads as an out-of-place rectangle on every themed surface around it.
2. **Byte weight.** Eight committed MP4s plus posters (~4.5 MB per ADR-0008's own estimate) are shipped, cached, and versioned in git to render art that a drawing function now produces at zero transfer cost.
3. **Consistency.** The SVG floor and the MP4 were two artifacts of one composition (ADR-0008 risk R3, drift); the field engine makes motion and stillness the same artifact — one source, animated or frozen.

## Decision

Case-study reels render as pixel fields:

- `components/work/reels.tsx` keeps its name, its exported interface (`ReelSlug`, `REEL_SLUGS`, `isReelSlug`, `Reel({ slug, variant })`) and all three call sites (`components/sections/Work.tsx`, `components/work/CaseStudyPage.tsx`, `components/sections/CaseStudyStub.tsx`). What changed is what it renders: the slug's own product source from `lib/pixel/products.ts` (U1), mounted through `components/work/reel-field.tsx`.
- `variant="hero"` maps to the field engine's `band` preset; `variant="card"` maps to `tile`. Both were chosen against the real rendered surfaces — the detail-page media band and small card contexts.
- There is no video element and no JS motion gate in the reel path. The field engine already reads `prefers-reduced-motion()` and `html[data-motion]` per frame and holds still; the reduced-motion contract holds as *a still field* rather than *an unrequested download*, asserted in `e2e/reduced-motion.spec.ts` with the same canvas-sampling technique as the hero field.
- The HyperFrames assets and automation are retired from the case-study path: the compositions, the committed `public/video/work/**` media, and the render scripts become unconsumed once no code references them. Deletion follows the repo's dead-code vote procedure and is not part of this decision record.

The writing-post loops (`public/video/writing/`, `components/media/hyperframes-loop.tsx`, ADR-0011) keep their pipeline until their own replacement decision lands; they share `MotionVideo` with nothing after this change, which makes it the natural next candidate but does not delete it here.

## Consequences

- Reels re-theme with light/dark mode instantly and cost zero network bytes.
- Per-case art is code-reviewed TypeScript (`lib/pixel/products.ts`), not a binary diff; determinism comes from `seedFrom(slug)`.
- Reduced-motion behaviour is enforced by the shared engine rather than per-component gates, removing the `MotionVideo` client component from the reel path.
- The HyperFrames authoring workflow (HTML + GSAP timelines → local render → commit binaries) has no consumer left on this path. Its scripts stay in-tree pending the deletion vote; until then they are inert author-time tooling.
- ADR-0008's remaining content (writing-post context, the general "pre-render vs live" tradeoff analysis) remains historically accurate but its case-study integration section describes superseded wiring.
