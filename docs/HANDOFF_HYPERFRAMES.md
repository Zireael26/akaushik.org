# Handoff — HyperFrames render pass

> **Superseded (2026-04-24).** Directory rename to `akaushik.org` landed per ADR-0003. Repo path is now `~/projects/personal/akaushik.org/`. This handoff is retained as historical context.

> **Paste everything below the `---` into a fresh Claude Code session** opened at the repository root (`~/projects/personal/developerabhishek.live/` on disk today; rename deferred per §15 of the main HANDOFF.md). This handoff completes the post-launch reel-rendering slice already scaffolded in-session; your job is the render → commit loop, not the authoring.

---

You are finishing a post-launch slice that replaces the home-page Work cards and case-study hero bands' SVG placeholders with real HyperFrames-rendered MP4 loops. The scaffolding, eight compositions, orchestrator scripts, React integration, CSS gating, ADR, CHANGELOG, and ROADMAP updates are already staged on the working tree. **Your job is to run the render, verify the gates pass, and commit.**

## Context to load before running anything

Read these, in this order, before any command:

1. `docs/adr/0008-hyperframes-rendering-pipeline.md` — the decision rationale (why HyperFrames, one-project-per-composition, commit-the-MP4s, CSS-only motion gate).
2. `scripts/hyperframes/README.md` — project layout + commands + authoring guide. The 8-slug table is the canonical list.
3. `components/work/reels.tsx` — new component shape. Note the `variant: 'card' | 'hero'` prop + the stacked SVG-floor-under-video render.
4. `app/globals.css` — grep for `.reel-video`, `[data-motion='off']`, `prefers-reduced-motion` to see the gating.
5. `docs/CHANGELOG.md` first `[Unreleased] / ### Added` bullet — describes exactly what was changed and why.

**Do not** edit any composition `index.html`, the orchestrator scripts, the React components, or the CSS unless a verification step below flags a real bug. The authoring pass is complete.

## What's already done (do not redo)

- `scripts/hyperframes/README.md` + `shared/{tokens,base}.css`
- 8 compositions at `scripts/hyperframes/<slug>/{index.html,hyperframes.json}`:
  - cards (600×400, 5s): `neev`, `vericite`, `bluehost-agents`, `curat-money`
  - heroes (1600×900, 10s): `neev-hero`, `vericite-hero`, `bluehost-agents-hero`, `curat-money-hero`
- `scripts/hyperframes/render-all.mjs` — renders + runs ffmpeg `+faststart` post-process
- `scripts/hyperframes/generate-posters.mjs` — pulls t=0.5s frame as `.webp`
- `package.json` — `render:work` + `render:posters` scripts
- `components/work/reels.tsx` — rewritten with `variant` prop + video+SVG stacking
- `components/work/CaseStudyPage.tsx` + `components/sections/CaseStudyStub.tsx` — pass `variant="hero"`
- `app/globals.css` — `.reel-video` positioning + `[data-motion='off']` / `prefers-reduced-motion` hide rules
- `docs/adr/0008-hyperframes-rendering-pipeline.md`
- `docs/CHANGELOG.md` — `[Unreleased] / ### Added` entry describes the full slice
- `docs/ROADMAP.md` — Post-launch marks the reel item `[~]` pending the render

## Your task, in order

### 1. Environment self-check

```bash
node --version            # must be ≥ 22
ffmpeg -version | head -1 # must exist on PATH
cd scripts/hyperframes/neev && pnpm dlx hyperframes doctor
cd ../../..
```

If `hyperframes doctor` reports a missing headless Chrome, run `pnpm dlx hyperframes browser ensure` — HyperFrames will download the matching binary under its cache dir. Do this once; it persists across renders.

If any of the above fail, **stop and report back** to Abhishek with the exact error — do not try to work around missing tooling (that's what ADR-0008 R1 calls out). Install guidance: `brew install ffmpeg` on macOS, `apt install ffmpeg` on Debian/Ubuntu, Node 22 is already pinned in `package.json#engines`.

### 2. Render a single composition as a smoke test

```bash
pnpm render:work -- --only neev
```

Expected output: `public/video/work/neev.mp4` (~200 KB, 600×400, 5s, H.264 yuv420p with `+faststart`). If it's smaller than 50 KB or larger than 2 MB, something is wrong — inspect the composition's HTML in a browser (open `scripts/hyperframes/neev/index.html` directly) before rendering again.

Visual spot-check the MP4 — open it in the default video player:
- 5-second loop of the Neev node graph
- Primary forest node at left-center (180, 200) with pulse rings expanding + fading
- Two satellite nodes at (360, 130) and (420, 280)
- Packets (light-green dots) travelling along the three edges
- Faint 45° diagonal stripes in the background
- No frozen frames, no visible seams at the loop point

If the MP4 looks broken, re-read the composition's `index.html` and `docs/adr/0008-hyperframes-rendering-pipeline.md` "Implementation" section before touching anything else.

### 3. Render the remaining seven

```bash
pnpm render:work
```

This re-runs `neev` as the first step (harmless, overwrites the smoke-test MP4 with the same output) then renders the other seven. Expect 3–5 minutes total on a modern dev box. If any single slug fails, `render-all.mjs` continues with the rest and reports failures at the end with a non-zero exit code.

### 4. Generate posters

```bash
pnpm render:posters
```

Writes `public/video/work/<slug>.webp` for each MP4. These are what `<video poster="…">` shows before autoplay kicks in and what reduced-motion users see when the JS layer hides the video.

### 5. Gate pass

```bash
pnpm typecheck
pnpm lint
pnpm process:check
```

All three must be green. If `typecheck` complains, look at `components/work/reels.tsx` first — the `variant?: 'card' | 'hero'` prop + the two callsites in `CaseStudyPage.tsx` + `CaseStudyStub.tsx` are the integration points most likely to have drifted in transit.

`process:check` R1 requires any staged change under `components/` / `scripts/` / `app/` to ship alongside a `docs/CHANGELOG.md` edit — already staged. R2 requires any staged `package.json` edit to ship with an ADR or CHANGELOG — ADR-0008 + CHANGELOG both staged. R3 doesn't apply (no `docs/epm/` changes).

### 6. Manual verification in the browser

```bash
pnpm dev
```

Open `http://localhost:3000` and verify:

- **Home Work section.** Each of the four cards shows its reel. Autoplay starts, loops seamlessly, muted. SVG is visually indistinguishable from the MP4's first frame (the SVG is what you see under the video if it ever fails to load).
- **Case study hero.** Navigate to `/work/neev`, `/work/vericite`, `/work/curat-money`, and `/work/bluehost-agents` (Bluehost has no MDX body — it falls through to the `CaseStudyStub` but still mounts the hero reel). Each shows the 16:9 hero band with the ambient 10s loop.
- **Motion off.** Open DevTools console, run `document.documentElement.setAttribute('data-motion', 'off')`. Every `<video>` should hide; the SVG floor should take its place with no layout shift.
- **Reduced motion.** Emulate `prefers-reduced-motion: reduce` via DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion". Same result as `data-motion="off"`.
- **Network tab with motion off.** Hard-reload with `data-motion="off"` pre-set (or add it to `<html>` in `app/layout.tsx` temporarily). No `.mp4` should load. The `.webp` posters still load (they're cheap and act as a lightweight visual anchor for SSR).

### 7. Bundle check

```bash
pnpm build
```

Look at the Next.js build output's "First Load JS" line for the home route. It should be unchanged from the pre-slice number (the integration is pure HTML — no new JS imports). If it grew by more than ~1 KB, something's wrong — read `components/work/reels.tsx` carefully; it must remain a server component with no client hooks.

### 8. Commit

Stage the MP4s + posters + all already-edited files together:

```bash
git add public/video/work/
git add scripts/hyperframes/
git add package.json
git add components/work/reels.tsx
git add components/work/CaseStudyPage.tsx
git add components/sections/CaseStudyStub.tsx
git add app/globals.css
git add docs/adr/0008-hyperframes-rendering-pipeline.md
git add docs/CHANGELOG.md
git add docs/ROADMAP.md
git add docs/HANDOFF_HYPERFRAMES.md
```

Then commit with a message that names ADR-0008 explicitly (process-gate will pass; the pre-commit hook runs `pnpm process:check`):

```
feat(work): swap SVG reel placeholders for HyperFrames MP4 loops (ADR-0008)

- 8 compositions under scripts/hyperframes/ (4 cards, 4 heroes)
- MP4s committed to public/video/work/<slug>.mp4 + .webp posters
- <video> stacks over SVG floor; [data-motion=off] + prefers-reduced-motion hide the video via pure CSS
- components/work/reels.tsx gets a `variant: 'card' | 'hero'` prop
- CaseStudyPage + CaseStudyStub pass variant="hero"
- render:work + render:posters pnpm scripts drive pnpm dlx hyperframes render + ffmpeg +faststart

Closes the `placeholder-label · hyperframes` promise in the home Work section
and the case-study hero bands. CI does not render; MP4s are author-time
artifacts committed alongside composition source (same pattern as OG images).
```

Push when ready. Do **not** merge to `main` until Abhishek has eyes on the deployed preview — the rest of this slice is craftsmanship-sensitive.

## What to do if something breaks

- **HyperFrames CLI throws on an unexpected flag.** Read the CLI's `--help`, update `render-all.mjs` to match, and note the drift in a short CHANGELOG bullet. ADR-0008 R1 calls this out as an anticipated risk.
- **A composition renders with wrong colours.** The most likely cause is token drift between `scripts/hyperframes/shared/tokens.css` and `app/globals.css`. Diff the two `:root` blocks; the shared file is the canonical subset, mirror-only.
- **`<video>` doesn't autoplay in Safari.** Confirm `muted` + `playsInline` attributes are present on the rendered DOM (they're on the component). If Safari regresses further, the CSS gate lets you disable the video entirely by toggling `display: none` on `.reel-video` unconditionally — the SVG floor takes over cleanly.
- **Bundle grew.** `components/work/reels.tsx` must stay a server component. No `'use client'`, no hooks, no `next/dynamic`. If you accidentally pulled in a client dep, revert to the version in the staged working tree.
- **Gate fails on process:check R1 or R2.** The staged changes already include a CHANGELOG entry + ADR — if the gate still complains, run `git status` and confirm you haven't `git add`-ed only a subset. Full list is in §8 above.

## What NOT to do

- Do not re-author compositions or timelines. The Neev/VeriCite/Bluehost/curat.money vocabulary is a direct port from `components/work/reels.tsx` SVG placeholders — changing it decouples the video from the SVG floor and breaks the reduced-motion fallback.
- Do not move the MP4s out of `public/video/work/` — the React component + every `<source src=…>` URL hardcodes that path.
- Do not add `'use client'` to `components/work/reels.tsx`. Motion gating is CSS-only by design (ADR-0008).
- Do not run `pnpm render:work` in CI. The MP4s are committed artifacts; CI + Lighthouse + E2E run against the repo's public/ tree.

When done, report back: gate status, rendered file sizes per slug, any composition that visually drifted from the SVG floor, and the commit SHA. Push to a feature branch and open a PR against `main` — don't merge directly.
