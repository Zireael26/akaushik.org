# Wanderer redesign brief

**Status:** implementation reinstated and locally verified; clean-head bundle, Linux CI, and production proof open.
**Owner:** Abhishek Kaushik.
**Last updated:** 2026-07-15.

## Current state

- Three.js paper-crane companion. `#companion` host div + inline SVG fallback in `components/scene/Wanderer.tsx`; client crane in `components/scene/WandererCrane.tsx`; client gate in `components/scene/WandererCraneClient.tsx`.
- Eight named POSES driven by `data-companion-pose` attributes on every home section. IntersectionObserver thresholds `[0.2, 0.45, 0.7]` pick the highest-intersecting section as the active pose.
- Per-frame: `damp = 1 - exp(-dt * 3.2)` lerp on 8 channels, scroll-velocity rotation on Y + Z, wing-flap from `Math.sin(t * flapSpeed) * flapAmt`.
- The root layout mounts `<Wanderer />`, but its eight-pose choreography is home-route-only. CSS limits the host to home pages at widths of at least 861px and hides it for detail routes, reduced motion, or runtime motion-off. The client scene lazy-loads raw `three`; the SVG is the no-WebGL fallback on an otherwise-allowed desktop.
- Accent changes continue to retint the crane. The paper-crane motif and pointer parallax are retained.
- The renderer is bounded to a 1920×1080 physical-pixel budget, caps DPR at 1.5 below that ceiling, and pauses its RAF while the document is hidden. Pose arbitration retains ratios across incremental IntersectionObserver callbacks and selects the globally most-visible section.
- Exact runtime-head Chromium verification on 2026-07-15 is green: 11 passed and one breakpoint-inapplicable skip across real canvas, forced no-WebGL fallback, non-home absence, client navigation, dominant-pose arbitration, pre-hydration motion-off, and runtime teardown/restore. Earlier exact 375×667 WebKit absence coverage is green. Firefox headless remains locally blocked before page load by the macOS launcher defect; Linux CI and production evidence remain spec-003 T10/T13 work.

Full primer: `.claude/primers/wanderer-crane-scene.md`.

## Why it was disabled (historical)

> Comment out `<Wanderer />` import + JSX in `app/layout.tsx` so the Three.js paper crane and its SVG fallback are both hidden site-wide. `components/scene/Wanderer*` untouched; reinstating is one uncomment.

The PR body does not name the trigger explicitly. Inferred from CHANGELOG + the surrounding commits: the crane was visually distracting at certain scroll positions on small viewports, and the redesign decision was deferred rather than rushed.

## Decisions implemented in the current implementation

1. **Motif:** retain the paper crane.
2. **Motion:** retain section poses, scroll choreography, and pointer parallax.
3. **Fallback:** retain the SVG only for no-WebGL on an allowed desktop; hide the whole host for mobile, reduced motion, and runtime motion-off.
4. **Route and breakpoint:** home-route-only and desktop-only from 861px, matching the pose-anchor and CSS policies; detail pages remain unobstructed.
5. **Theme:** retain live accent synchronisation.
6. **Runtime:** use raw `three` with no new framework dependency. Bound fill rate and background work in code; clean-head bundle and production evidence stay with spec-003 T9/T13.

## Reinstatement checklist

The historical checklist is retained so code closure and documentation/validation closure remain distinguishable:

- [x] Restore the `import { Wanderer }` line in `app/layout.tsx`.
- [x] Restore the `<Wanderer />` JSX in `app/layout.tsx`.
- [x] Replace unconditional skip wrappers with policy-specific browser coverage, including real-canvas and forced-fallback proofs.
- [x] Refresh `.claude/primers/wanderer-crane-scene.md` — drop the STATUS banner, bump `last_refreshed`.
- [x] Update `.claude/primers/INDEX.md` — drop the "Currently disabled" tag.
- [x] Reconcile the ROADMAP entries: implementation is complete; clean-head bundle, Linux CI, and production proof remain explicit post-launch validation work.
- [x] Update the primer's Data flow + Gotchas sections for the home-route and lazy-load policies; per-frame channels remain unchanged.
- [x] Add a `docs/CHANGELOG.md` entry under `[Unreleased]` summarising the reinstatement.
- [~] Refresh clean-head bundle evidence and complete Linux CI/production validation under spec-003 T9/T10/T13; the 2026-07-04 bundle snapshot predates reinstatement.

## What does **not** need to change to reinstate

- `app/sitemap.ts` / agent-readiness surfaces.
- The OG image pipeline.
- The HyperFrames reels.
- The raw-Three.js hero `AgentGraph` (separate scene, separate file, governed by ADR-0012).

## Out of scope for the brief

- Replacing raw Three.js for the hero. ADR-0012 governs that separate decision and supersedes ADR-0007.
- Removing the SVG fallback entirely. The accessibility surface that path covers is non-negotiable per PRD §7.
