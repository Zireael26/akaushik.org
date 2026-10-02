---
slug: wanderer-crane-scene
purpose: Retired-feature notice for the removed Wanderer scene, with its hand-written implementation notes retained as historical context.
pinned_to: 883e508dd3e7e4c7b3247ebcb575228c6840b5bd
created: 2026-05-15
last_refreshed: 2026-10-03
related_primers: []
---

# Wanderer Crane Scene

## Status at HEAD

The Three.js Wanderer is retired from the current site. The pixel-transplant plan records `Wanderer` and `three` as deleted, task T30 records the dead-code sweep as complete, and the changelog names the removed scene components, stylesheet, and unit test (`specs/004-pixel-transplant/plan.md:38`; `specs/004-pixel-transplant/tasks.md:72`; `docs/CHANGELOG.md:914`).

The current root layout renders `SiteNav`, page children, `SiteFooter`, and `Cursor`; it does not mount `<Wanderer />` (`app/layout.tsx:127-133`). One legacy `data-companion-pose="about"` attribute remains on the profile section; it is markup residue, not a live scene contract (`components/sections/About.tsx:61`; scene removal: `specs/004-pixel-transplant/tasks.md:72`).

`docs/wanderer-redesign-brief.md` describes the pre-transplant reinstatement and is dated 2026-07-15; the later 2026-08-22 dead-code sweep supersedes its live-implementation status (`docs/wanderer-redesign-brief.md:1-4`; `docs/CHANGELOG.md:914`). Do not use the deleted component paths or old test commands as current entry points.

## Historical gotchas (pre-transplant; not current implementation guidance)

The notes below are preserved verbatim from the retired implementation primer. The scene components and unit test they describe were later deleted (`docs/CHANGELOG.md:914`; `specs/004-pixel-transplant/tasks.md:72`).

- **Three lerps, not one.** Eight pose channels (x, y, z, rotY, rotX, scale, flap, spin) are lerped independently every frame. If you add a channel, add it to both `POSES` rows _and_ the per-frame lerp block; missing entries silently freeze at the hero defaults.
- **The policy is intentionally checked twice.** `WandererCraneClient` owns live route/viewport/motion transitions through `usePathname` and `useSyncExternalStore`; `WandererCrane` repeats the checks at effect mount so a policy change while the lazy chunk is in flight cannot create a stale canvas.
- **IntersectionObserver thresholds are `[0.2, 0.45, 0.7]`** and the algorithm picks the highest intersecting ratio. Short sections can reach an intersection ratio of `1` when fully visible. A very tall section's maximum ratio is roughly viewport height divided by section height, so it may never reach even the `0.2` threshold; use a sentinel or adjust the thresholds if such an anchor needs finer updates.
- **`scrollVel` damps each frame** (`*= 0.9`). Fast flicks momentarily flare wing-flap amount + Y-rotation; this is intentional. Don't normalize it without checking the design intent.
- **WebGL context creation is the bail-out.** A `try`/`catch` around `new THREE.WebGLRenderer` is the only context-loss handler — there's no `webglcontextlost` listener. Acceptable today because the SVG fallback is the explicit recovery surface; revisit if mobile Safari starts losing context mid-session.
- **`#companion` host is global.** Only one Wanderer per page. Adding a second `<Wanderer />` will fight over the same `#companion` div and the SVG removal/restore will tear.
- **Detail routes must stay hidden before hydration.** The CSS `:has(~ main [data-companion-pose])` gate prevents the default hero pose from covering detail metadata before `usePathname()` runs. Keep the CSS and client route gates aligned.
- **First-render warmup is intentional.** `renderer.render(scene, camera)` runs once before the RAF loop so shaders compile before the SVG hides; removing it causes a one-frame "blank" between SVG-hide and first-paint.
- **GPU pressure is explicitly bounded.** The canvas fills the viewport in CSS, but its drawing buffer never exceeds 1920×1080 physical pixels and DPR is capped at 1.5 below that limit. The RAF pauses while `document.hidden` is true. Re-measure before raising either ceiling.

## Historical validation note

The former primer's test note is quoted verbatim as history; its named unit test was deleted with the scene (`docs/CHANGELOG.md:914`; `specs/004-pixel-transplant/tasks.md:72`).

> `WandererCrane.test.ts` is load-bearing for pose arbitration: it proves that an incremental callback for a less-visible section does not erase the still-visible dominant section, then proves dominance transfers when that section exits. It does not exercise the browser's `IntersectionObserver`; the Playwright coverage remains the runtime proof. The SVG silhouette inside `Wanderer.tsx` must remain a byte-faithful port of `_reference/portfolio/companion.js:211–219`.

## Historical notes

- ADR-0012 records the wrapper-library removal. Both AgentGraph and Wanderer now use raw Three.js.
- If a redesign demands a different pose set, edit `POSES` _and_ every section's `data-companion-pose` attribute together; mismatches fail open (no pose change) rather than error.
