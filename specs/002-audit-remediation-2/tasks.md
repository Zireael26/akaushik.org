# Tasks: Audit Remediation 2

**Slug:** `audit-remediation-2`
**Date:** 2026-07-13
**Spec:** `specs/002-audit-remediation-2/spec.md`
**Plan:** `specs/002-audit-remediation-2/plan.md`
**Status:** in-progress

---

## Working contract

- Source of truth for the work breakdown. Tick a box only with a fail-before/pass-after verifier.
- Each task ≤4h, implemented by `codex-worker` (gpt-5.6-sol), gated + committed by the orchestrator.

## Tasks

| ID | Task | Pri | Covers (spec §3) | Status |
|----|------|-----|------|--------|
| T1 | Add production draft gate (`draft===true && NODE_ENV==='production' → notFound()`) to both `.md` route handlers and both `opengraph-image.tsx`; add regression e2e. | P1 | Drafts 404 on all surfaces | [x] |
| T2 | Sanitize `getPost()` slug (allowlist + resolved-path containment) in `lib/content.ts`; add traversal unit test. | P1 | Slug can't escape content dir | [x] |
| T3 | Add `pnpm test:coverage` step to `.github/workflows/ci.yml` verify job. | P2 | CI enforces tests+coverage | [x] |
| T4 | Add per-page `openGraph` to work/writing `[slug]` + index metadata; use `frontmatter.date` for sitemap `lastModified`. | P2 | Per-page OG; sitemap date | [ ] |
| T5 | Make canvas reduced-motion/motion-off e2e assertions deterministic; remove armed `continue-on-error` on Axe; delete stale WCAG "fixme" comment. | P2 | Gates fail on inverted requirement | [ ] |
| T6 | Fix `lib/dates.ts` invalid-date rollover, `lib/reading-time.ts` hyphen + bare-`<` stripping, `lib/content.ts` inline-array comma parsing; add fail-before/pass-after tests. | P3 | lib edges handled | [ ] |
| T7 | Add CSP + `X-Frame-Options` + HSTS to `proxy.ts` `buildResponseHeaders()`; add header e2e assertion. | P3 | Security headers present | [ ] |
| T8 | Add `renderer.forceContextLoss()` on unmount + re-apply device-pixel-ratio in `AgentGraph.tsx`. | P3 | WebGL context + DPR | [ ] |
| T9 | Remove unused `clsx`/`tailwind-merge` deps; make `stats.json` `includesPrivate` reflect the token used; update stale `middleware.ts` comments in `next.config.ts`. | P3 | No unused dep / false claim / stale comment | [ ] |

## Coverage map

| Spec criterion | Covering tasks |
|---|---|
| Drafts 404 on all surfaces | T1 |
| Slug can't escape content dir | T2 |
| CI enforces tests+coverage | T3 |
| Per-page OG; sitemap date | T4 |
| Gates fail on inverted requirement | T5 |
| lib edges handled | T6 |
| Security headers present | T7 |
| WebGL context + DPR | T8 |
| No unused dep / false claim / stale comment | T9 |

## Held (editorial — not in this loop)

- Delete dead `reel` frontmatter field (4 content MDX files).
- Publish any specific `draft: true` post.

## Done criteria

- [ ] Every task checked with a passing fail-before/pass-after verifier.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] Process-gate verdict MERGEABLE.
- [ ] PR opened on `feature/audit-remediation-2` (no merge to main).

## Status updates

- 2026-07-13: created from `plan.md`, 0/9 tasks complete.
