# Bundle budget

**Aspirational target:** <= 150 KiB gzipped initial JS.
**Ceiling enforced in CI today:** 400 KiB script-resource transferSize, `warn` severity, in both `lighthouserc.yml` and `lighthouserc.mobile.yml`.
**Latest committed measurement (2026-07-04 audit, before Wanderer reinstatement):** 299,026 bytes (~292 KiB) script transferSize per Lighthouse `resource-summary` audit. That audited build was below the warning ceiling and still above the 150 KiB aspiration; it does not measure the reinstated Wanderer runtime.

> The 400 KiB ceiling is a noise-control ceiling, not the product target. The product target remains 150 KiB. The 2026-07-04 result is a pre-reinstatement baseline only: no post-reinstatement total or Wanderer byte delta is recorded yet, and spec-003 T9 owns that clean-head refresh.

## Snapshots

- **2026-07-04, audit-remediation baseline (pre-Wanderer reinstatement):** `docs/bundle-snapshots/2026-07-04-bundle.md`. Script transferSize 299,026 bytes. Desktop and mobile runs cleared the configured Lighthouse assertions; local mobile performance cleared the configured score but missed the stricter LCP aspiration at ~3.6s.
- **2026-05-19, post-Phase-5:** `docs/bundle-snapshots/2026-05-19-bundle.md`. 377 KiB script, 786 KiB total transfer before the ADR-0012 raw-Three.js port.
- **2026-04-20, Phase 3.3 (historical):** Top chunks were 69.4 KiB / 39.3 KiB / 38.6 KiB gzipped. Landing-page initial JS sat near the 150 KiB aspiration before the 3D and media surfaces landed.

## Method

```
pnpm build
pnpm start
npx --yes @lhci/cli@latest autorun \
  --collect.url=http://localhost:3000/ \
  --config=./lighthouserc.yml
```

Per-route initial JS is what Lighthouse CI's `resource-summary:script:size` asserts on. The script transferSize in the assertion is the gzipped wire-bytes Lighthouse observed during the run, not the disk size of chunks under `.next/static/chunks/`.

## Server isolation (ADR-0004)

Shiki stays in the Node server bundle only. MDX compilation + syntax highlighting never reach the browser. Continue to verify this with `pnpm analyze` when MDX or syntax-highlighting dependencies change.

## Current pressure

1. `components/scene/AgentGraph.tsx` is raw `three`. ADR-0012 removed the framework layer and cut the prior 386,439-byte measurement to the ~290-300 KiB range, but the `three` runtime is still the dominant browser cost.
2. `<Wanderer />` is mounted in `app/layout.tsx`, while `WandererCrane` is a `React.lazy` runtime requested only after the home-route, 861px viewport, reduced-motion, and runtime motion gates pass. The latest snapshot predates that reinstatement, so its transfer cost and any chunk sharing with `AgentGraph` remain unmeasured.
3. HyperFrames writing-post + case-study loops are mostly media transfer rather than script transfer, but their poster/video choices still affect mobile LCP.

## Path back to 150 KiB

1. Capture a clean-head analyzer/Lighthouse measurement for the reinstated runtime, including an allowed desktop path and the gated mobile path; compare it with the 2026-07-04 baseline before assigning a Wanderer delta.
2. Decide whether the measured raw-Three.js experience is worth the remaining gap over the aspiration.
3. If the answer is no, prototype a smaller WebGL primitive or static/recorded hero treatment.
4. Keep mobile LCP as the next user-facing performance target; the local 2026-07-04 run cleared configured category thresholds but missed the stricter <2.5s LCP aspiration.
