---
slug: wanderer-crane-scene
purpose: Single-instance paper-crane Three.js companion driven by document scroll and IntersectionObserver pose anchors, with SVG fallback for reduced-motion users. Currently disabled in app/layout.tsx; code preserved.
pinned_to: 903ccde
created: 2026-05-15
last_refreshed: 2026-07-04
related_primers: []
---

# Wanderer Crane Scene

> ⚠ **STATUS (2026-05-19): Wanderer is checked-in but disabled.** `<Wanderer />` is commented out at `app/layout.tsx:120` behind a `TODO: temporarily disabled — reinstate when crane returns` comment. The component code, `WandererCraneClient`, `WandererCrane`, and the `e2e/canvas.spec.ts` assertions for the companion path all remain. Until reinstated, the SVG fallback never appears on the live site (because the host `#companion` div is also not rendered) and the e2e assertions on the companion canvas pass vacuously. Surfaced in `docs/gap-analysis-2026-05-19.md` finding C2. Reinstate or move to a post-launch ROADMAP item.

## Purpose

A single paper-crane Three.js scene that floats alongside the home composite, repositioning between scripted poses as the visitor scrolls past `[data-companion-pose]` anchors. Provides ambient motion without claiming any document flow. Falls back to a static SVG silhouette for reduced-motion, motion-off, and WebGL-unavailable environments.

## Entry points

- `components/scene/Wanderer.tsx` — server component. Renders the `#companion` host div + inline SVG fallback; mounts `<WandererCraneClient />`.
- `components/scene/WandererCraneClient.tsx` — client wrapper. Reads `prefers-reduced-motion` + `[data-motion]` via `useSyncExternalStore`, lazy-imports the scene through `next/dynamic({ ssr: false })`, unmounts when motion is toggled off.
- `components/scene/WandererCrane.tsx` — the scene. Direct `useEffect`-driven Three.js: geometry, lighting, RAF loop, `IntersectionObserver` on pose anchors, scroll-velocity damping, MutationObserver for accent swaps.

## Data flow

A scroll past the `[data-companion-pose="work"]` section:

1. `Wanderer` ships server-side: `#companion` host div + inline SVG silhouette + `<WandererCraneClient />` placeholder.
2. On hydration, `WandererCraneClient` consults `useSyncExternalStore`. If `prefers-reduced-motion` matches or `data-motion="off"` is on `<html>`, it returns null and the SVG stays visible.
3. Otherwise the dynamic import resolves and `WandererCrane`'s `useEffect` runs: creates a `<canvas>` inside `#companion`, instantiates `WebGLRenderer` (guarded by try/catch), scene, perspective camera at `z=8`, three lights (key/rim/ambient), and `buildCrane()` (octahedron body, cone beak, two wings, tail strip).
4. `IntersectionObserver` (thresholds `[0.2, 0.45, 0.7]`) watches every `[data-companion-pose]` element. As the user scrolls, the entry with the highest intersection ratio wins; its `data-companion-pose` value indexes `POSES` (eight: hero / work / about / writing / services / process / open / contact) and the result is copied into `target`.
5. The RAF loop runs per frame: `damp = 1 - exp(-dt * 3.2)`, lerp every pose channel from `current` toward `target`, position the crane in viewport-normalized space (`halfW`/`halfH` from camera FOV), apply scroll-velocity rotation (`scrollVel * 2.2` on Y, `-scrollVel * 1.1` on Z), and flap the wings (`Math.sin(t * flapSpeed) * flapAmt` where both speed and amount inherit from the active pose plus `|scrollVel|`).
6. Once the first real frame renders, the inline SVG silhouette is hidden (`svg.style.display = 'none'`) so both don't composite.
7. A `MutationObserver` on `<html>` resyncs the crane's accent material color when `data-accent` or `data-mode` changes (theme swatch).
8. Cleanup on unmount disposes geometries, materials, the renderer, observers, listeners; re-shows the SVG fallback.

## Dependencies

- `three` — direct API shared with the AgentGraph scene. Wrapper libraries are not installed.
- `next/dynamic` — `ssr: false` lazy import of the crane bundle.
- `_reference/portfolio/companion.js` — historical 221-LOC source the crane is ported from. Geometry coords + pose tables match line-for-line; refer to it when a "why does it look this way" question comes up.
- DOM contracts: every section that drives a pose change must carry `data-companion-pose="<name>"` matching a key in `POSES`. Unknown keys are silently ignored.

## Test commands

```bash
# No dedicated unit suite — verification is visual + reduced-motion path.
pnpm dev
# Then in a browser:
#   - scroll the home page; the crane should snap (smoothly) between pose anchors
#   - System Settings → Accessibility → Reduce Motion ON → reload → SVG only
#   - <html data-motion="off"> via the tweaks panel → crane unmounts, SVG returns
#   - swap accent via tweaks panel → crane's beak/details retint live

# Playwright e2e (smoke against the SVG fallback path and DOM contracts)
pnpm test:e2e
```

There are no Vitest tests for the scene; the closest thing to a fixture is the SVG silhouette inside `Wanderer.tsx` — it must remain a byte-faithful port of `_reference/portfolio/companion.js:211–219`.

## Gotchas

- **Three lerps, not one.** Eight pose channels (x, y, z, rotY, rotX, scale, flap, spin) are lerped independently every frame. If you add a channel, add it to both `POSES` rows _and_ the per-frame lerp block; missing entries silently freeze at the hero defaults.
- **`reduceMotion` is checked once at mount.** The crane itself doesn't observe the media query after init — the runtime gate lives in `WandererCraneClient` via `useSyncExternalStore`. Toggling motion off unmounts the component (runs cleanup) and remounts on toggle back on. Don't add a second media-query check inside the scene.
- **IntersectionObserver thresholds are `[0.2, 0.45, 0.7]`** and the algorithm picks the highest intersecting ratio. Sections shorter than ~20% of the viewport will never trigger a pose change — keep `[data-companion-pose]` blocks tall, or add a sentinel.
- **`scrollVel` damps each frame** (`*= 0.9`). Fast flicks momentarily flare wing-flap amount + Y-rotation; this is intentional. Don't normalize it without checking the design intent.
- **WebGL context creation is the bail-out.** A `try`/`catch` around `new THREE.WebGLRenderer` is the only context-loss handler — there's no `webglcontextlost` listener. Acceptable today because the SVG fallback is the explicit recovery surface; revisit if mobile Safari starts losing context mid-session.
- **`#companion` host is global.** Only one Wanderer per page. Adding a second `<Wanderer />` will fight over the same `#companion` div and the SVG removal/restore will tear.
- **First-render warmup is intentional.** `renderer.render(scene, camera)` runs once before the RAF loop so shaders compile before the SVG hides; removing it causes a one-frame "blank" between SVG-hide and first-paint.
- **GPU pressure.** The scene runs at native devicePixelRatio (capped to 2) and full window dimensions — on a 4K display it pushes a lot of pixels for a crane that's ~20% of the viewport. Acceptable today; if a future Retina-mobile profile shows main-thread frame skips, downscale the canvas.

## Out of scope

- The AgentGraph hero scene (`components/scene/AgentGraph.tsx` + `AgentGraphClient.tsx`) — separate raw Three.js scene, separate decisions.
- The TweakBridge / accent + motion control panel — sets `data-motion` and `data-accent` on `<html>`; this primer only consumes those attributes.
- HyperFrames reels (`components/work/reels.tsx`) — separate motion surface for the case-study cards/hero bands.

## Notes

- ADR-0012 records the wrapper-library removal. Both AgentGraph and Wanderer now use raw Three.js.
- If a redesign demands a different pose set, edit `POSES` _and_ every section's `data-companion-pose` attribute together; mismatches fail open (no pose change) rather than error.
