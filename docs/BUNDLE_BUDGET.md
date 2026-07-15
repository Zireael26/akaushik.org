# Bundle and runtime budget

[ADR-0016](adr/0016-post-launch-runtime-and-bundle-budget.md) replaces the permanently-red 150 KiB aspiration with a measured operating budget. Historical snapshots keep their original metrics; do not compare their numbers without normalizing the method.

## Active budgets

| Surface                            |                                           Budget or alert | Enforcement and response                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build/runtime                      |                                               Node `22.x` | Build evidence is invalid under another major. CI and production automation must select Node 22.                                                              |
| Normal-motion desktop home scripts |       **<= 350 KiB (358,400 B)** gzip response-body bytes | Active operating budget. Reduce, document a time-bounded exception, or supersede ADR-0016 when exceeded.                                                      |
| Lighthouse script monitor          | **<= 400 KiB (409,600 B)** `resource-summary:script:size` | Warning-only in [desktop](../lighthouserc.yml) and [mobile](../lighthouserc.mobile.yml) configs. A warning requires investigation; it is not silently raised. |
| Production homepage TTFB           |                        **< 2,500 ms median of 3 samples** | Scheduled alert threshold in [check-production.mjs](../scripts/check-production.mjs). No production pass is claimed by the local bundle snapshot.             |

The 350 KiB budget counts local script response bodies declared by `/` plus scene chunks that a normal-motion desktop visit can load. It excludes route HTML, CSS, fonts, images, media, HTTP headers, and third-party scripts; those remain separately observable costs.

## Current baseline

The [2026-07-14 Node 22 snapshot](bundle-snapshots/2026-07-14-bundle.md) was captured from a local production server built from the live dirty checkout.

| Route        | Route HTML, identity | Route HTML, gzip median | HTML-declared scripts |                   Conditional scene scripts |      Composed script body |
| ------------ | -------------------: | ----------------------: | --------------------: | ------------------------------------------: | ------------------------: |
| `/`          |            111,119 B |                31,738 B |             201,557 B | 141,278 B (`three` + AgentGraph + Wanderer) | **342,835 B (334.8 KiB)** |
| `/work/neev` |             47,316 B |                15,915 B |             195,427 B |                 none; Wanderer is home-only |     195,427 B (190.8 KiB) |
| `/writing`   |             36,101 B |                11,318 B |             194,821 B |                 none; Wanderer is home-only |     194,821 B (190.3 KiB) |

These main routes are request-rendered (`ƒ`) because [ADR-0014](adr/0014-nonce-based-csp.md) requires a per-response nonce. They do not have route `.html` files under `.next/server/app`. The gzip HTML values are five-response medians because each nonce changes compression slightly.

“Composed script body” is arithmetic over measured local HTTP response bodies under the stated runtime gates. It is not a browser waterfall or Lighthouse `transferSize` result.

## Scene budget

| Chunk role           |       Raw | Local gzip body | Brotli-11 artifact estimate |
| -------------------- | --------: | --------------: | --------------------------: |
| Shared raw `three`   | 548,509 B |       136,119 B |                   110,875 B |
| AgentGraph component |   6,172 B |         2,662 B |                     2,320 B |
| Wanderer component   |   5,725 B |         2,497 B |                     2,155 B |

All three are lazy chunks and are absent from the route HTML's `<script src>` set. [AgentGraphClient](../components/scene/AgentGraphClient.tsx) loads AgentGraph after hydration when motion is allowed. [WandererCraneClient](../components/scene/WandererCraneClient.tsx) additionally requires the home route and a viewport of at least 861 px.

Wanderer therefore has two honest cost readings:

- **Home:** 2,497 gzip bytes attributable to the Wanderer component after AgentGraph has already loaded shared `three`.
- **Hypothetical first-scene cost:** 138,616 gzip bytes if a future route-policy change lets Wanderer load without AgentGraph. Current non-home routes load neither.

The initial wrapper chunk and server-rendered SVG are shared with other code/HTML and were not isolated by a no-Wanderer counterfactual build. Do not label 2,480 bytes as the total reinstatement delta.

## Measurement procedure

1. Capture the current tracked and untracked, non-ignored source state. Record `HEAD` and say whether the checkout is dirty.
2. Select Node 22 explicitly and run the production `pnpm build`; record the full exit code and route classification.
3. Start that exact artifact with `pnpm start`.
4. For `/`, `/work/neev`, and `/writing`, record identity HTML bytes, five gzip HTML samples, and every local `<script src>` response body with `Accept-Encoding: gzip`; verify non-home routes do not request scene chunks.
5. Map scene modules to their emitted chunks. Report shared `three`, AgentGraph, and Wanderer separately; never add the shared chunk twice.
6. Run Lighthouse separately when a Lighthouse-comparable number is required. Its `transferSize` result must not be substituted with gzip body arithmetic.

Refresh the snapshot when any of these change: a client dependency, a client/server boundary, root layout scripts, scene loading policy, Next.js, compression/hosting behavior, or the Node major.

## Escalation rules

- Above 350 KiB by the local method: stop and explain the regression. Prefer reducing it; otherwise record an owner-approved exception or superseding ADR.
- At or above the 400 KiB Lighthouse warning: do not raise the config in the same change merely to make CI quiet.
- A new scene must report both first-scene cost (including shared dependencies) and incremental cost when another scene already loaded them.
- A production TTFB alert is evidence of a runtime symptom, not proof of a bundle regression. Investigate server/network behavior separately.

## Server and media isolation

[ADR-0004](adr/0004-mdx-pipeline-and-bundle-isolation.md) keeps Shiki and MDX compilation in the Node server bundle. Verify that isolation with the analyzer when those dependencies or their import boundaries change.

HyperFrames video/poster bytes are media, not script. They remain part of LCP and total-transfer review even though they do not count against the 350 KiB script budget.

## Historical snapshots

- [2026-07-14](bundle-snapshots/2026-07-14-bundle.md) — Node 22 production artifact; route HTML, declared scripts, and lazy scene chunks measured separately. No fresh Lighthouse or deployed-production run.
- [2026-07-04](bundle-snapshots/2026-07-04-bundle.md) — Lighthouse script `transferSize` 299,026 bytes.
- [2026-05-19](bundle-snapshots/2026-05-19-bundle.md) — Lighthouse script `transferSize` 386,439 bytes before the ADR-0012 raw-Three.js port.
- 2026-04-20 — historical pre-scene chunk notes; retained for narrative only, not a comparable baseline.
