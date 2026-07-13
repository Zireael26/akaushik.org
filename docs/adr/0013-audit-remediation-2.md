# ADR-0013 — Audit remediation 2: draft-gating, path-safety, security headers, and CI/quality gates

**Status:** Accepted, 2026-07-13
**Context:** Closure of the 2026-07-13 repository audit (`audits/2026-07-13-audit.md`, `specs/002-audit-remediation-2`). Records the cross-cutting decisions in that remediation bundle; the per-task detail lives in the spec triad and `docs/CHANGELOG.md`.
**Author:** Claude (orchestrator), with gpt-5.6-sol implementing five of nine tasks.

## Context

The 2026-07-13 audit (dynamic workflow: gpt-5.6-sol finders + Claude adversarial verification) confirmed 28 findings after refutation. Spec 001's remediation held — all ten of its completion claims verified — but deeper issues remained. The bundle touches several load-bearing surfaces at once (route handlers, the request-boundary proxy, CI, and dependencies), which is why it is captured here rather than left implicit in commit messages.

Three decisions are architectural enough to record:

1. **Draft content was reachable in production on the agent/crawler surfaces.** The `.md` content-negotiation routes and the per-slug `opengraph-image` routes served `draft: true` posts (including an internal ClusterBid authoring note) with `X-Robots-Tag: index, follow`, because they relied on build-time `generateStaticParams` exclusion but never gated on-demand rendering.
2. **No security headers existed in active source.** `proxy.ts` set discovery/robots headers but no CSP, framing, or transport-security; `next.config.ts` covered only `/.well-known/*`.
3. **Quality gates were partly decorative.** CI never ran the unit suite or coverage; an armed accessibility gate still carried `continue-on-error`; two canvas e2e tests could not fail on regression.

## Decision

- **Draft gate (T1):** add an `isDraftHidden(fm)` helper (production-only) applied in both `.md` handlers and both `opengraph-image` handlers, plus `dynamicParams=false` so unknown/draft slugs 404 at the routing layer. Matches the HTML pages' existing guard. Publishing any specific draft remains separate editorial work.
- **Path safety (T2):** `getPost()` allowlists the slug (`^[a-z0-9_-]+$`) and asserts resolved-path containment before reading, closing a cross-content-type traversal.
- **Security headers (T7):** `proxy.ts` emits, in production only, a Content-Security-Policy (`default-src 'self'`; `script-src` allows self + inline hydration + the Cloudflare Web Analytics beacon origin; `frame-ancestors 'none'`; `object-src 'none'`), `X-Frame-Options: DENY`, and HSTS. Gated to `NODE_ENV==='production'` so dev HMR (eval) and the dev-only edit-mode iframe are unaffected. Verified against a production render: 0 CSP violations, beacon not blocked.
- **CI + quality gates (T3, T5):** CI runs `pnpm test:coverage` (enforcing the 75/55/75 floor on every PR, not only the local pre-push hook); the armed axe gate drops `continue-on-error` (0 violations verified on `/`, `/work/neev`, `/writing`); the canvas reduced-motion / data-motion tests assert `toHaveCount(0)` matching the real JS-gated mount behavior.
- **Latent correctness + hygiene (T4, T6, T8, T9):** per-page OpenGraph, per-post sitemap dates, date/reading-time/frontmatter-parser edge fixes, WebGL context release + DPR sync, unused-dep removal, honest `stats.json includesPrivate`, and stale-comment cleanup — detailed in the CHANGELOG.

The CSP uses `'unsafe-inline'` for `script-src` rather than a nonce pipeline: the App Router injects inline hydration scripts and there is no nonce infrastructure here, so this is a defense-in-depth baseline (framing + transport + resource-origin restriction), not a full XSS lockdown. A nonce-based CSP is a future ADR if warranted.

## Consequences

- Unpublished content is no longer served on any production surface; editorial intent is enforced in code, not convention.
- Production responses carry framing/transport/resource-origin protections; a stricter nonce CSP is deferred.
- A regression in the unit suite, coverage floor, or landing-page accessibility now fails CI (previously only local pre-push), so green CI is a stronger signal.
- The delivery followed a serial codex-implements / orchestrator-gates loop (gpt-5.6-sol at xhigh for T2/T4/T6/T7/T9); each task landed with a fail-before/pass-after verifier. Rollback is an ordinary `git revert` of the branch — no migrations, flags, or external state.
