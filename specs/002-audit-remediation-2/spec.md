# Spec: Audit Remediation 2

**Slug:** `audit-remediation-2`
**Date:** 2026-07-13
**Author:** Claude (orchestrator) + gpt-5.6-sol (finders)
**Status:** accepted

---

## 1. Problem statement

The 2026-07-13 audit (dynamic workflow, gpt-5.6-sol finders + Claude adversarial verification) confirmed 28 findings after refutation. Spec 001's remediation held — all ten of its completion claims verified true — but deeper issues remain. The most serious: the Markdown and OG-image content-negotiation routes serve `draft: true` posts (including a test fixture and an internal ClusterBid authoring note) in production with `X-Robots-Tag: index, follow`, on exactly the agent/crawler surface the site is built for — directly contradicting the editorial-approval intent. Alongside it sit a path-safety gap, false-green CI/quality gates, missing per-page social metadata, and a cluster of latent correctness and hygiene issues.

## 2. Users + scenario

- **Abhishek** — wants unpublished content to stay unpublished on every surface, and quality gates that actually gate.
- **Crawlers / AI agents** — consume the `.md` and OG surfaces; must not receive draft content.
- **Future agents** — need CI and coverage gates that fail on regression, not decoratively pass.

## 3. Success criteria

- [ ] No `draft: true` post is retrievable in a production build via `/writing/<slug>.md`, `/work/<slug>.md`, `Accept: text/markdown`, or `/<route>/opengraph-image` — each 404s, matching the HTML page.
- [ ] `getPost()` rejects slugs that escape the content-type directory; valid slugs are unaffected.
- [ ] CI runs the unit suite with coverage; a broken `lib/*.test.ts` or a coverage drop below threshold fails CI, not just local pre-push.
- [ ] Every `/work/<slug>`, `/writing/<slug>`, `/work`, `/writing` page emits its own `openGraph` (title/description/url) consistent with its canonical; sitemap `lastModified` reflects post date.
- [ ] The reduced-motion / motion-off e2e assertions fail when the requirement is inverted; the armed Axe scan can fail the workflow; no stale "fixme/disabled" comment describes a live gate.
- [ ] `lib/dates.ts`, `lib/reading-time.ts`, `lib/content.ts` inline-array parsing handle their documented edge inputs, each covered by a fail-before/pass-after test.
- [ ] `proxy.ts` responses carry a CSP, `X-Frame-Options`, and HSTS header on active routes.
- [ ] `AgentGraph` unmount forces WebGL context loss and keeps device-pixel-ratio in sync.
- [ ] No unused runtime dependency (`clsx`, `tailwind-merge`) remains; public `stats.json` `includesPrivate` reflects the token actually used; no active-code comment references the deleted `middleware.ts`.

## 4. Non-goals

- Publishing any `draft: true` post or the ClusterBid case study (editorial approval required).
- Deleting or rewiring the `reel` frontmatter field (content-file edit, held for editorial).
- Implementing `/api/mcp`, replacing Three.js, or hitting the ~150 KiB JS target.
- GSC/Bing verification, Wikidata, scheduled-task registration (human-owned).

## 5. Constraints

- Follow parent Trellis rules + this repo's `CLAUDE.md`; multi-file edits stay phased and verified.
- `content/` files are deliberate editorial units — the loop does not create, publish, or edit MDX content bodies (T1 changes route code, not content).
- Each task lands with a fail-before/pass-after verifier, not typecheck-only.
- Push-to-main is blocked; work lands on `feature/audit-remediation-2` and stops at process-gate + PR.

## 6. Open questions

None. Operator set scope (all P1–P3) and delivery (spec triad, one PR) on 2026-07-13; draft default is 404-gate.

## 7. Risks

- Draft gate could 404 a post meant to be live — mitigated: default matches current HTML-page behavior; publishing is separate editorial.
- Slug sanitization could reject a valid slug — mitigated: allowlist derived from existing content slugs + unit test.
- New CI test step could flake or double-run — mitigated: run locally green before commit.
- CSP could break Cloudflare analytics/fonts or Next inline hydration — mitigated: start report-compatible / permissive-enough, verify page renders.

## 8. Out of scope (intentional)

- PR merge or deployment. This pass stops at process-gate readiness + an opened PR.
- ~~A new ADR; existing ADRs govern.~~ Superseded during process-gate: the bundle changes ADR-trigger paths (`package.json`, `next.config.ts`) and exceeds the 800-line size cap, so `docs/adr/0013-audit-remediation-2.md` records the cross-cutting decisions (draft-gating, security headers, CI/quality gates).

---

## Review checklist

- [x] Problem statement names a real pain, not a solution
- [x] Every success criterion is testable
- [x] At least one non-goal is listed
- [x] Constraints cite their source
- [x] Open questions are real or explicitly none
- [x] No implementation detail crept in beyond audit scope
- [x] Readable in under 5 minutes
