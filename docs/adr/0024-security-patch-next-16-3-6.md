# ADR-0024: Security patch — Next.js 16.3.0/16.3.5 → 16.3.6

Status: Accepted, 2026-09-27 (operator-approved blanket; urgent security fix).

Spec: the cross-repo `SPEC.md` for security-patches lane (`~/projects/handoffs/2026-09-27/security-patches/SPEC.md`, converged after 5 multi-family review rounds: GPT-6 Sol, Muse Spark 1.3, Gemini 3.8 Flash). This ADR is the in-repo pointer and records the decision for this repo.

## Context

Three CRITICAL Next.js advisories affect `next` 16.3.0 (root, `apps/friendsof`, `apps/learn`) and 16.3.5 (`apps/demo`, GHSA-vcvr only):

| Advisory | Summary | Fixed |
|---|---|---|
| GHSA-2xp9-vwfh-vxw4 | Unauthenticated RCE in the Image Optimization API (AVIF) | 16.3.3 (AVIF re-enabled with fix in 16.3.4) |
| GHSA-p293-qw3h-jr36 | Unauthenticated RCE on Windows-hosted servers | 16.3.3 |
| GHSA-vcvr-r3jv-pc5j | RCE in `next/og` `ImageResponse` (Node runtime); `>=16.2.0 <16.3.6` | **16.3.6 only** |

GHSA-vcvr is published in the `vercel/next.js` repository advisories but was not yet in OSV or the global GHSA database on 2026-09-27, so OSV-only scans report 16.3.3 as clean. It is not.

This site and its three portals run on Cloudflare Workers via OpenNext and are deployed by hand (decisions-log D11/D13). No page imports `next/image`, but the root config sets `images.formats: ["image/avif", "image/webp"]` and production `/_next/image` answers 200. We therefore treat the optimizer as reachable. `next/og` renders the root and per-post Open Graph images (`app/opengraph-image.tsx`, `app/writing/[slug]/opengraph-image.tsx`, `app/work/[slug]/opengraph-image.tsx`) and `app/icon.tsx`.

16.3.6 was published on 2026-09-22, inside the 7-day `minimumReleaseAge` window. Following the repository's existing exact-version exception pattern, the root `minimumReleaseAgeExclude` entries for `next`, `eslint-config-next`, `@next/env`, `@next/eslint-plugin-next`, and `@next/swc-*` move from `@16.3.0` to `@16.3.6`. This is a documented security exception, approved by the coordinator on 2026-09-27. The policy itself stays on. Once 16.3.6 is older than 7 days, after 2026-09-29, the entries can be removed.

## Decision

Bump `next` and `eslint-config-next` to exactly `16.3.6`. `@next/env`, `@next/eslint-plugin-next` and `@next/swc-*` follow transitively. No other dependency changes. Applies to the root package and all three apps (each has its own lockfile). `@next/bundle-analyzer` is untouched. This stays within ADR-0001 (16.3.x baseline) and ADR-0017 (overrides and audit receipts).

## Consequences

- All three advisories are cleared. The image optimizer keeps AVIF enabled, and it is patched.
- Rollback re-opens a CRITICAL RCE. Forward-fix is the default. If a rollback is unavoidable, block `/_next/image*` at the edge first.
- Follow-ups (out of scope): sharp override → 0.35.4 (GHSA-rgj7; next 16.3.6 declares `^0.35.4`), and the transitive HIGH advisories from the 2026-09-27 dependency audit.
