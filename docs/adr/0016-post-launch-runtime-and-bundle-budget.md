# ADR-0016 — Post-launch runtime and bundle budget

**Status:** Accepted, 2026-07-14
**Context:** Post-launch closure of the Node runtime and the permanently-red 150 KiB script aspiration.
**Author:** Codex, for Abhishek Kaushik.

## Context

The original 150 KiB initial-JavaScript aspiration described an earlier, mostly static version of the site. It was already exceeded before the raw-Three.js port in [ADR-0012](0012-r3f-to-raw-three-agent-graph.md), and it remained red after that port even though the hero scene is an intentional product surface. Keeping an unattainable number as the only target made the budget informational rather than operational.

Two later decisions changed the runtime shape:

- [ADR-0014](0014-nonce-based-csp.md) intentionally made the main HTML routes request-rendered so every response can carry a fresh CSP nonce. Route HTML is therefore a response measurement, not a checked-in `.html` artifact.
- The desktop-only Wanderer was reinstated with a React-lazy scene import and the same raw `three` dependency as AgentGraph. Its cost depends on whether another scene already loaded the shared `three` chunk.

The repository now declares Node `22.x` in [package.json](../../package.json) and `22` in [.nvmrc](../../.nvmrc). The evidence behind this decision is the local production-mode capture in the [2026-07-14 bundle snapshot](../bundle-snapshots/2026-07-14-bundle.md).

## Decision

### Runtime

- Node 22 is the build and automation runtime. A bundle receipt is invalid unless `node --version` reports a Node 22 release. The accepted snapshot used Node 22.23.1 and pnpm 11.9.0.
- The scheduled production monitor uses three sequential homepage samples and alerts when median TTFB exceeds 2,500 ms. This is an alert boundary for the nonce-rendered production route, not a claim that production currently clears it.
- Build wall time is recorded as diagnostic evidence. The 2026-07-14 local build completed in 13.37 seconds, but host-dependent wall time is not a bundle gate.

### Browser script budget

Adopt **350 KiB (358,400 bytes)** as the active normal-motion desktop-home budget for gzip response-body bytes of:

1. local scripts declared by the route HTML, including `/init-theme.js`; and
2. the shared `three` chunk plus the AgentGraph and Wanderer scene chunks that the desktop/motion policy can load after hydration.

The final integrated composition is 342,835 bytes (334.8 KiB), leaving 15,565 bytes (15.2 KiB, 4.5%) of headroom. Route HTML, CSS, fonts, images, and media remain separate measurements and do not count toward this script number.

The existing **400 KiB Lighthouse `resource-summary:script:size` warning** remains the CI monitoring ceiling. It is intentionally not renamed as the product target or a hard gate: Lighthouse `transferSize` is not byte-for-byte equivalent to the gzip response-body method above, and the current configuration is warning-only. Crossing either the 350 KiB operating budget or the 400 KiB Lighthouse warning requires a fresh snapshot and one of:

- reduce the regression before release;
- document a time-bounded exception with an owner and rollback; or
- accept a new architectural trade-off in a superseding ADR.

The former 150 KiB value remains historical context, not an active acceptance target.

### Scene accounting

The current production artifact separates the scene code as follows:

| Payload                    | Raw artifact | Local gzip response body | Disposition                                 |
| -------------------------- | -----------: | -----------------------: | ------------------------------------------- |
| Shared raw `three` chunk   |    548,509 B |                136,119 B | Count once whenever either scene loads.     |
| AgentGraph component chunk |      6,172 B |                  2,662 B | Home route, normal-motion gate.             |
| Wanderer component chunk   |      5,725 B |                  2,497 B | Home route, desktop and normal-motion gate. |

The scene filenames are absent from the server-rendered HTML's script tags; they are runtime-loaded chunks. On the home route, AgentGraph already needs `three`, so the measured Wanderer-attributable lazy payload is 2,497 gzip bytes. Wanderer is home-route-only: detail and index routes do not load it or shared `three`. If that route gate is changed later, its hypothetical first-scene cost is 138,616 gzip bytes for `three` plus the crane chunk. This is not presented as a total before/after Wanderer delta: the wrapper shares an initial chunk and the SVG fallback contributes route HTML, and no controlled no-Wanderer rebuild was run.

## Consequences

- The budget is green but tight enough to detect a meaningful dependency or client-boundary regression.
- Raw Three.js remains an explicit, measured design cost rather than a permanently open exception.
- Route HTML and conditional chunks cannot be conflated with static chunk disk sizes; every snapshot must report them separately.
- A fresh Lighthouse run may produce a different number because its `transferSize` method, browser profile, headers, cache state, and optional analytics requests differ. Comparisons must use the same method on both sides.
- The 2026-07-14 evidence is from a Node 22 local production server built from a live dirty checkout. It is not deployed-production, Vercel-runtime, analyzer, or post-deployment evidence.

## Alternatives considered

**Keep 150 KiB as the only target.** Rejected. It has been red across multiple accepted scene implementations and no longer guides release decisions.

**Use the existing 400 KiB warning as the product target.** Rejected. It leaves too much unexamined headroom and uses a different measurement contract.

**Remove AgentGraph or Wanderer to recover the old target.** Rejected for this decision. AgentGraph is governed by ADR-0012 and Wanderer was reinstated under the accepted post-launch scope; either removal is a separate product decision.

**Budget all `.next/static/chunks` bytes.** Rejected. That charges routes for code they do not request and erases the distinction between declared, shared, and policy-gated chunks.

## Operating reference

The measurement procedure, breach handling, and historical baselines live in [BUNDLE_BUDGET.md](../BUNDLE_BUDGET.md).
