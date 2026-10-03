# scripts/hyperframes

Pre-rendered motion reels that live where a loop beats a live scene: the four
case-study cards on the home `Work` section and the hero band on each
`/work/[slug]` detail page. Ported verbatim from the SVG placeholders in
`components/work/reels.tsx`, rendered via HeyGen's HyperFrames HTML-to-video
pipeline, and committed as MP4s under `public/video/work/`.

See `docs/adr/0008-hyperframes-rendering-pipeline.md` for the decision
rationale (why HyperFrames, why commit the MP4s, why this layout).

## Layout

```
scripts/hyperframes/
  shared/
    tokens.css          # design tokens mirrored from app/globals.css
    base.css            # composition layout + clip helpers
  <slug>/               # one HyperFrames project per composition
    index.html          # data-composition-id="root" + gsap timeline
    hyperframes.json    # local project config
  render-all.mjs        # orchestrator — drives the CLI for every slug
  generate-posters.mjs  # pulls a single frame as .webp poster
  README.md             # you are here
```

One project per composition trades a little duplication for a very simple
render step (`cd <slug> && pnpm dlx hyperframes render …`) and means a broken
composition never blocks the others. The eight slugs:

| Slug                      | Aspect  | Duration | Target                                           |
| ------------------------- | ------- | -------- | ------------------------------------------------ |
| `neev`                    | 600×400 | 5s loop  | Home Work card · `components/work/reels.tsx`     |
| `vericite`                | 600×400 | 5s loop  | Home Work card                                   |
| `bluehost-agents`         | 600×400 | 5s loop  | Home Work card                                   |
| `curat-money`             | 600×400 | 5s loop  | Home Work card                                   |
| `neev-hero`               | 1600×900| 10s loop | `/work/neev` hero band                           |
| `vericite-hero`           | 1600×900| 10s loop | `/work/vericite` hero band                       |
| `bluehost-agents-hero`    | 1600×900| 10s loop | `/work/bluehost-agents` hero band                |
| `curat-money-hero`        | 1600×900| 10s loop | `/work/curat-money` hero band                    |

## Prerequisites

- Node ≥ 22 (already pinned in `package.json#engines`)
- FFmpeg on PATH — `brew install ffmpeg` / `apt install ffmpeg`
- `cwebp` (libwebp) — `brew install webp` / `apt install webp`. Needed by
  `generate-posters.mjs` because Homebrew's ffmpeg 8.x ships without libwebp
- Headless Chrome — HyperFrames bootstraps this automatically via
  `pnpm dlx hyperframes browser ensure`; first render will download it

Run `pnpm dlx hyperframes doctor` from any composition dir to self-check.

## Commands

From the repo root:

```bash
# render every composition → public/video/work/<slug>.mp4
pnpm render:work

# render a single composition (faster iteration)
pnpm render:work -- --only neev

# regenerate posters from existing MP4s (does not re-render)
pnpm render:posters
```

CI doesn't render videos. The MP4s are committed artifacts — re-render only
when a composition changes, then commit the updated `public/video/work/*.mp4`
alongside the composition diff.

## Authoring a new composition

1. Copy `neev/` (simplest card reel) to `<new-slug>/`
2. Change `data-composition-id="root"` is fine to leave; rename the outer
   `<body>` class if you want per-slug selectors
3. Update the viewport via `data-width` / `data-height` on `#root`
4. Register the timeline on `window.__timelines["root"]`
5. Add `<new-slug>` to the `SLUGS` array in `render-all.mjs`
6. Add a `<Reel slug="<new-slug>">` consumer somewhere in `components/`
7. `pnpm render:work -- --only <new-slug>` then commit both the HTML and
   the resulting `public/video/work/<new-slug>.mp4`

## Reduced-motion + video gating

The React side (`components/work/reels.tsx`) renders `<video autoplay muted
loop playsinline poster="…">` under a `prefers-reduced-motion: no-preference`
+ `[data-motion="on"]` gate. The original SVG stays as the fallback when
either gate is off, so no network cost is paid for motion-disabled users.

The MP4s ship with `-movflags +faststart` so the first frame is served with
the mdat atom available, letting `<video>` paint before the stream finishes
(see render-all.mjs for the exact ffmpeg flags).
