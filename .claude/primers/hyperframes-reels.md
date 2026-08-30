---
slug: hyperframes-reels
purpose: HTML/GSAP compositions rendered to deterministic MP4 reels for case-study cards and hero bands via the HyperFrames CLI; artifacts are committed.
pinned_to: e73ab4026fe93e8f216d4c3fea227ca26a1fdbac
created: 2026-05-15
last_refreshed: 2026-05-19
related_primers: [og-image-generation, mdx-content-pipeline]
---

# HyperFrames Reels

## Purpose

Pre-render motion reels for the four home `Work` cards (600×400, 5s loop) and the four `/work/<slug>` hero bands (1600×900, 10s loop), so the site has ambient case-study motion without paying live-animation cost on the main thread. Compositions are authored as plain HTML + GSAP timelines, rendered locally via the HyperFrames CLI, and the resulting MP4 + WebP poster pair is committed alongside the source.

> The same pipeline serves the **writing-post loops** under `public/video/writing/` (16:9, 5s). Composition sources for the writing slugs land under `scripts/hyperframes/<slug>/` when they exist; the policy + exceptions are codified in **ADR-0011**. Two writing posts (`trellis`, `best-practices-into-trellis`) intentionally ship without loops per the non-visual exception in that ADR.

## Entry points

- Composition projects live in `scripts/hyperframes/neev/`, `scripts/hyperframes/vericite/`, `scripts/hyperframes/bluehost-agents/`, `scripts/hyperframes/curat-money/`, and their concrete `scripts/hyperframes/neev-hero/`, `scripts/hyperframes/vericite-hero/`, `scripts/hyperframes/bluehost-agents-hero/`, `scripts/hyperframes/curat-money-hero/` variants. Each directory contains `index.html` and `hyperframes.json`.
- `scripts/hyperframes/shared/tokens.css` + `base.css` — design tokens mirrored from `app/globals.css` plus composition layout/clip helpers. Subset only — flagged in the file header as drift-prone.

## Data flow

Re-rendering Neev after a composition edit:

1. Author edits `scripts/hyperframes/neev/index.html` (GSAP timeline registered on `window.__timelines["root"]`).
2. From the repo root, the author runs `pnpm render:work --only neev`.
3. `render-all.mjs` enters `scripts/hyperframes/neev/` and spawns `npx --yes hyperframes render --output …/neev.raw.mp4 --fps 30 --quality standard`.
4. HyperFrames boots headless Chrome (bootstrapped lazily via `npx hyperframes browser ensure` on first run), mirrors `performance.now()` to deterministic frame timestamps, seeks the GSAP timeline frame-by-frame, captures each frame, and encodes to the raw MP4.
5. `render-all.mjs` post-processes with `ffmpeg` to add `+faststart` (moov atom at head, required for `<video autoplay>` to begin before download completes), re-encoding H.264 high profile, yuv420p, no audio, CRF 23.
6. Output lands at `public/video/work/neev.mp4`. Author runs `pnpm render:posters` to refresh `neev.webp`.
7. Both artifacts are committed. CI does not re-render — `_movflags + faststart_` and the committed binary are the canonical artifact.
8. On the live site, `components/work/reels.tsx:Reel` ships `<svg class="reel-fallback">` + `<video class="reel-video" preload="none" poster="…webp">`. CSS in `app/globals.css` hides `.reel-video` under `prefers-reduced-motion: reduce` and `[data-motion="off"]` — pure CSS gate, no hydration cost.

## Dependencies

- HyperFrames CLI (`npx hyperframes`) — invoked at author-time. Telemetry + update checks disabled via `HYPERFRAMES_NO_TELEMETRY=1` and `HYPERFRAMES_NO_UPDATE_CHECK=1` so a published update doesn't silently change render output.
- Headless Chrome — auto-bootstrapped by HyperFrames; first render downloads it.
- `ffmpeg` on PATH — required for `+faststart` post-pass. `brew install ffmpeg` / `apt install ffmpeg`.
- `cwebp` (libwebp) — required by `generate-posters.mjs` because Homebrew's ffmpeg 8.x ships without libwebp. `brew install webp`.
- `gsap` (`^3.13.0`) — already in main bundle for unrelated reasons; compositions load it via CDN inside the headless sandbox, not from `node_modules`.

## Test commands

The "test" for hyperframes is the deterministic local render — HyperFrames seeks frames against a fixed timestamp clock, so a passing render with byte-stable output is the verification surface.

```bash
# Render every composition (8 MP4s, ~3–5 minutes on a dev box)
pnpm render:work

# Render one slug (fast author-time iteration)
node scripts/hyperframes/render-all.mjs --only neev
node scripts/hyperframes/render-all.mjs --only neev --skip-ffmpeg  # debug

# Regenerate posters after MP4 changes
pnpm render:posters

# Self-check the CLI / Chrome bootstrap
cd scripts/hyperframes/neev && npx hyperframes doctor

# Visually inspect the result
pnpm dev    # then load /work/neev and the home Work section
```

No Vitest or Playwright coverage — the artifact itself is the receipt. After re-rendering, `git diff --stat public/video/work/` shows which slugs changed.

## Gotchas

- **CI does not run the renderer.** The MP4s are committed artifacts. A composition edit that doesn't bring fresh `public/video/work/*.mp4` will ship the old reel silently. The author-time workflow is "edit composition, render locally, commit both."
- **Token drift between `scripts/hyperframes/shared/tokens.css` and `app/globals.css:root`.** The hyperframes side is a hand-mirrored subset. ADR-0008 R3 flags this; the file header repeats the warning. A quarterly visual diff catches drift; no automated check.
- **HyperFrames CLI is young.** Subcommand shape (`render`, `browser ensure`, `doctor`) could shift in a minor version. `render-all.mjs` is a thin wrapper around documented flags — a breaking change is a small patch.
- **`+faststart` is mandatory.** Without it, `<video autoplay>` won't begin painting until the full file arrives. The skipped-ffmpeg flag is for debugging only — do not commit `*.raw.mp4` named without re-encoding.
- **Browser autoplay rules can tighten.** `<video autoplay muted loop playsInline>` is the current safe combination; Safari + some Chrome flavours periodically tighten policies on silent loops. The CSS gate means the SVG fallback can take over without code churn.
- **`<video preload="none">` is load-bearing.** Motion-disabled users never pay bytes for the MP4; only the poster WebP downloads. Removing it would re-introduce ~4.5 MB of MP4 bytes on every page load.
- **One project per composition.** Tried-and-rejected alternative was one HyperFrames project with multiple compositions — CLI's multi-comp selection story is underdocumented and a broken timeline would block siblings.
- **The SVG fallback is a literal port of the placeholder.** `Reel` always renders the SVG; the video paints over it when motion is on. A composition that drifts visually from its SVG will look discontinuous to a motion-off user toggling motion on.

## Out of scope

- The live OG-image renderer at `app/**/opengraph-image.tsx` — different rendering pipeline, different artifact lifecycle. See `og-image-generation` primer.
- The R3F Wanderer crane and AgentGraph scenes — main-thread, not pre-rendered.
- Composition authoring details (GSAP timeline shape, frame budget) — see `scripts/hyperframes/README.md`.

## Notes

- `pnpm render:work --skip-ffmpeg` leaves the raw HyperFrames output without re-encoding — useful when diffing raw vs post-processed output to isolate a regression.
- ADR-0008 covers eight risks/alternatives in detail (Lottie, Framer Motion, Rive, Remotion). Read it before proposing a switch.
- `docs/CHANGELOG.md` should record composition rerenders alongside the binary commit — the process-gate enforces this when `public/video/work/*` is treated as `content/`-equivalent (it isn't today; revisit if drift becomes a problem).
