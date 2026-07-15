---
slug: wanderer-crane-scene
purpose: Home-only desktop paper-crane Three.js companion driven by document scroll and IntersectionObserver pose anchors, with a no-WebGL SVG fallback and strict route/motion gates.
pinned_to: 087020d
created: 2026-05-15
last_refreshed: 2026-07-15
related_primers: []
---

# Wanderer Crane Scene

## Purpose

A single paper-crane Three.js scene that floats alongside the home composite, repositioning between scripted poses as the visitor scrolls past `[data-companion-pose]` anchors. It is absent on non-home routes, viewports below 861px, reduced-motion presentations, and runtime motion-off. On an otherwise-allowed desktop, it falls back to the server-rendered SVG when WebGL is unavailable.

## Entry points

- `components/scene/Wanderer.tsx` — server component. Renders the `#companion` host div + inline SVG fallback; mounts `<WandererCraneClient />`.
- `components/scene/WandererCraneClient.tsx` — client wrapper. Combines `usePathname()` with desktop, reduced-motion, and `[data-motion]` snapshots; lazy-imports the scene through `React.lazy`; unmounts when any policy gate closes.
- `components/scene/WandererCrane.tsx` — the scene. Direct `useEffect`-driven Three.js: geometry, lighting, RAF loop, `IntersectionObserver` on pose anchors, scroll-velocity damping, MutationObserver for accent swaps.

## Data flow

A scroll past the `[data-companion-pose="work"]` section:

1. `Wanderer` ships server-side: `#companion` host div + inline SVG silhouette + `<WandererCraneClient />` placeholder. CSS shows that host only when a later `main` sibling contains the home pose anchors and the desktop/motion media policy passes.
2. On hydration, `WandererCraneClient` also requires `pathname === '/'`, a viewport of at least 861px, no reduced-motion preference, and `data-motion !== "off"`. A closed gate returns null and keeps the entire host hidden.
3. When allowed, the wrapper marks the SVG as the settled `fallback` renderer while `React.lazy` resolves. `WandererCrane` then creates a `<canvas>` inside `#companion`, instantiates `WebGLRenderer` (guarded by try/catch), scene, perspective camera at `z=8`, three lights (key/rim/ambient), and `buildCrane()` (octahedron body, cone beak, two wings, tail strip).
4. `IntersectionObserver` (thresholds `[0.2, 0.45, 0.7]`) watches every `[data-companion-pose]` element. Ratios are retained across incremental observer callbacks, so the globally highest intersecting section wins even when it did not cross a threshold in the latest callback. Its `data-companion-pose` value indexes `POSES` (eight: hero / work / about / writing / services / process / open / contact) and the result is copied into `target`.
5. The RAF loop runs per frame: `damp = 1 - exp(-dt * 3.2)`, lerp every pose channel from `current` toward `target`, position the crane in viewport-normalized space (`halfW`/`halfH` from camera FOV), apply scroll-velocity rotation (`scrollVel * 2.2` on Y, `-scrollVel * 1.1` on Z), and flap the wings (`Math.sin(t * flapSpeed) * flapAmt` where both speed and amount inherit from the active pose plus `|scrollVel|`).
6. Once the first real frame renders, the host is promoted to `data-wanderer-renderer="canvas"` and the inline SVG silhouette is hidden so both don't composite. Failed context creation leaves `fallback` active.
7. A `MutationObserver` on `<html>` resyncs the crane's accent material color when `data-accent` or `data-mode` changes (theme swatch).
8. Cleanup on unmount disposes geometries, materials, the renderer, observers, listeners; re-shows the SVG fallback.

## Dependencies

- `three` — direct API shared with the AgentGraph scene. Wrapper libraries are not installed.
- `React.lazy` / `Suspense` — imports the crane chunk only after the route, viewport, and motion policy passes, without publishing a preload for gated clients.
- `_reference/portfolio/companion.js` — historical 221-LOC source the crane is ported from. Geometry coords + pose tables match line-for-line; refer to it when a "why does it look this way" question comes up.
- DOM contracts: every section that drives a pose change must carry `data-companion-pose="<name>"` matching a key in `POSES`. Unknown keys are silently ignored.

## Test commands

```bash
# Unit: retain visible ratios across incremental observer callbacks and select
# the globally most-visible pose anchor.
pnpm exec vitest run components/scene/WandererCrane.test.ts

# Build/start separately, then prove real canvas, forced no-WebGL fallback,
# route/breakpoint absence, and live motion-policy teardown/restore.
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test \
  e2e/canvas.spec.ts e2e/reduced-motion.spec.ts \
  --project=chromium-desktop --workers=1
```

`WandererCrane.test.ts` is load-bearing for pose arbitration: it proves that an incremental callback for a less-visible section does not erase the still-visible dominant section, then proves dominance transfers when that section exits. It does not exercise the browser's `IntersectionObserver`; the Playwright coverage remains the runtime proof. The SVG silhouette inside `Wanderer.tsx` must remain a byte-faithful port of `_reference/portfolio/companion.js:211–219`.

## Gotchas

- **Three lerps, not one.** Eight pose channels (x, y, z, rotY, rotX, scale, flap, spin) are lerped independently every frame. If you add a channel, add it to both `POSES` rows _and_ the per-frame lerp block; missing entries silently freeze at the hero defaults.
- **The policy is intentionally checked twice.** `WandererCraneClient` owns live route/viewport/motion transitions through `usePathname` and `useSyncExternalStore`; `WandererCrane` repeats the checks at effect mount so a policy change while the lazy chunk is in flight cannot create a stale canvas.
- **IntersectionObserver thresholds are `[0.2, 0.45, 0.7]`** and the algorithm picks the highest intersecting ratio. Short sections can reach an intersection ratio of `1` when fully visible. A very tall section's maximum ratio is roughly viewport height divided by section height, so it may never reach even the `0.2` threshold; use a sentinel or adjust the thresholds if such an anchor needs finer updates.
- **`scrollVel` damps each frame** (`*= 0.9`). Fast flicks momentarily flare wing-flap amount + Y-rotation; this is intentional. Don't normalize it without checking the design intent.
- **WebGL context creation is the bail-out.** A `try`/`catch` around `new THREE.WebGLRenderer` is the only context-loss handler — there's no `webglcontextlost` listener. Acceptable today because the SVG fallback is the explicit recovery surface; revisit if mobile Safari starts losing context mid-session.
- **`#companion` host is global.** Only one Wanderer per page. Adding a second `<Wanderer />` will fight over the same `#companion` div and the SVG removal/restore will tear.
- **Detail routes must stay hidden before hydration.** The CSS `:has(~ main [data-companion-pose])` gate prevents the default hero pose from covering detail metadata before `usePathname()` runs. Keep the CSS and client route gates aligned.
- **First-render warmup is intentional.** `renderer.render(scene, camera)` runs once before the RAF loop so shaders compile before the SVG hides; removing it causes a one-frame "blank" between SVG-hide and first-paint.
- **GPU pressure is explicitly bounded.** The canvas fills the viewport in CSS, but its drawing buffer never exceeds 1920×1080 physical pixels and DPR is capped at 1.5 below that limit. The RAF pauses while `document.hidden` is true. Re-measure before raising either ceiling.

## Out of scope

- The AgentGraph hero scene (`components/scene/AgentGraph.tsx` + `AgentGraphClient.tsx`) — separate raw Three.js scene, separate decisions.
- The TweakBridge / accent + motion control panel — sets `data-motion` and `data-accent` on `<html>`; this primer only consumes those attributes.
- HyperFrames reels (`components/work/reels.tsx`) — separate motion surface for the case-study cards/hero bands.

## Notes

- ADR-0012 records the wrapper-library removal. Both AgentGraph and Wanderer now use raw Three.js.
- If a redesign demands a different pose set, edit `POSES` _and_ every section's `data-companion-pose` attribute together; mismatches fail open (no pose change) rather than error.
