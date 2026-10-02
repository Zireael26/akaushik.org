---
slug: hyperframes-reels
purpose: Current case-study reels are theme-responsive PixelFields; the HyperFrames render pipeline is retained only as an unconsumed legacy tool.
pinned_to: 883e508dd3e7e4c7b3247ebcb575228c6840b5bd
created: 2026-05-15
last_refreshed: 2026-10-03
related_primers: [og-image-generation, mdx-content-pipeline]
---

# Reels: HyperFrames retired

## Current implementation

The `Reel` interface survives, but case-study media is now a canvas field rather than an SVG/video stack (ADR-0020). The field draws the matching product source, follows the site's light/dark theme, and respects reduced motion. Writing-post loops were retired too; writing detail pages use `RouteField` instead.

- `components/work/reels.tsx` defines `ReelSlug`, `REEL_SLUGS`, `isReelSlug`, and `Reel({ slug, variant })`. The five slugs are Neev, VeriCite, Bluehost Agents, curat.money, and ClusterBid. `card` uses the `tile` field preset; `hero` uses `hero`.
- `components/work/reel-field.tsx` resolves the product source by slug, seeds it with that slug, and mounts `PixelField` with `animate={3}`.
- Active `Reel` call sites: `components/work/CaseStudyPage.tsx` and `components/sections/CaseStudyStub.tsx`. The home Work section is a matter-row list, not a reel-card grid (`components/sections/Work.tsx`).
- `components/work/reels.test.tsx` verifies both variants for every slug and asserts the output contains no `<video>`, `<svg>`, or `/video/` media URL.
- The shared field engine repaints for the current theme and suppresses ambient/source animation when either `html[data-motion="off"]` or OS reduced motion is active. No per-reel video gate is needed.

## Entry points

- `components/work/reels.tsx` + `components/work/reel-field.tsx` — current case-study field integration.
- `components/pixel/PixelField.tsx`, `lib/pixel/field.ts`, `lib/pixel.ts` — canvas mount, render loop, theme palette, and motion preference.
- `lib/pixel/products.ts` — product-source registry; keep its slugs aligned with `ReelSlug`.
- `components/work/reels.test.tsx` — reel markup contract.
- `app/writing/[slug]/page.tsx` + `components/pixel/RouteField.tsx` — writing detail art, replacing the former writing loops.
- `docs/adr/0020-canvas-fields-over-hyperframes-video.md` — accepted replacement decision. ADR-0008's case-study integration and ADR-0011's writing-loop policy are superseded.

## Data flow

1. A work detail page or stub passes its slug and `variant="hero"` to `Reel`.
2. `Reel` maps its variant to a field preset and mounts `ReelField`.
3. `ReelField` looks up `productSource(slug)`, derives `seedFrom(slug)`, and passes both to `PixelField`.
4. `PixelField` mounts the shared canvas engine. It renders with theme-aware palette values and holds animated geometry still for reduced-motion settings.

## Legacy HyperFrames tooling

The old HTML/GSAP compositions, shared CSS, `render-all.mjs`, and `generate-posters.mjs` remain under `scripts/hyperframes/`. `package.json` still exposes `render:work` and `render:posters`; the renderer's fixed eight-slug list writes to `public/video/work/`. These scripts remain callable and, when successful, write files; the current reel path has no consumer for those outputs. Do not treat their README or ADR-0008's former runtime wiring as current behavior. ADR-0020 records the retirement; the writing-loop retirement is also recorded there.

## Verification

```bash
pnpm test components/work/reels.test.tsx
```

This focused test checks the shipping markup contract for every registered slug and both variants. `pnpm test` runs Vitest.

## Gotchas

- **Do not reintroduce the old video/SVG fallback or motion gate as current behavior.** The field is the shipped reel; the test rejects video, SVG, and media URLs.
- **The retained renderer is archival, not the reel source of truth.** `render-all.mjs` still lists the former four card and four hero compositions, while the current field registry includes ClusterBid. Rendering can recreate unconsumed files; it does not update the current canvas artwork.
- **The HyperFrames token stylesheet is stale relative to the live theme.** `scripts/hyperframes/shared/tokens.css` remains a hand-mirrored legacy subset; the current application tokens and pixel engine use a different palette. This drift matters only if the retired renderer is deliberately revived.
- **Legacy `--skip-ffmpeg` is debug-only.** It renames the raw HyperFrames render to the output `.mp4` without re-encoding. Normal post-processing adds `+faststart`; there is no current Reel-path consumer for these outputs.
- **One project per composition** remains the layout of the retained sources. The multi-composition CLI alternative was rejected in ADR-0008 because its selection story was underdocumented and a broken timeline could block siblings.

## Notes

- `pnpm render:work --skip-ffmpeg` writes the raw HyperFrames output without re-encoding (as the output `.mp4`); it is useful when diffing raw vs post-processed output to isolate a regression.
- ADR-0008 covers the pipeline rationale, risks, and alternatives in detail. Read it before proposing a switch.
