# Plan: Audit Remediation 2

**Slug:** `audit-remediation-2`
**Date:** 2026-07-13
**Spec:** `specs/002-audit-remediation-2/spec.md`
**Status:** accepted

---

## 1. Technical approach

Nine independent remediation tasks, executed by a **serial codex-implements / Claude-gates loop**: each task is a frozen work-order handed to `codex-worker` (gpt-5.6-sol, xhigh); the orchestrator (Claude) reviews the diff, runs the task's fail-before/pass-after verifier plus `typecheck`/`lint`/`test`, then commits and ticks. Serial because parallel edits collide in one checkout. Codex writes land in the main checkout (verified via write-path probe). Bright-line ops — diff review, verify, commit, PR — stay on the orchestrator.

## 2. Data model + schema changes

None.

## 3. API surface

No new routes. Behavior changes: the `.md` and `opengraph-image` route handlers gain a production draft gate (404 for `draft: true`); `proxy.ts` adds security headers. Content-negotiation for published content is unchanged.

## 4. File-by-file change list

| # | Task | Files | Action |
|---|------|-------|--------|
| T1 | Draft gate | `app/writing/[slug]/md/route.ts`, `app/work/[slug]/md/route.ts`, `app/writing/[slug]/opengraph-image.tsx`, `app/work/[slug]/opengraph-image.tsx`, `e2e/content-negotiation.spec.ts` | modify + test |
| T2 | Slug sanitization | `lib/content.ts`, `lib/content.test.ts` | modify + test |
| T3 | CI runs tests+coverage | `.github/workflows/ci.yml` | modify |
| T4 | Per-page OG + sitemap date | `app/work/[slug]/page.tsx`, `app/writing/[slug]/page.tsx`, `app/work/page.tsx`, `app/writing/page.tsx`, `app/sitemap.ts` | modify |
| T5 | De-vacuum gates | `e2e/canvas.spec.ts`, `.github/workflows/lighthouse.yml`, `e2e/home.spec.ts` | modify |
| T6 | lib correctness | `lib/dates.ts`, `lib/reading-time.ts`, `lib/content.ts` + their `*.test.ts` | modify + test |
| T7 | Security headers | `proxy.ts` (+ `e2e/` header assertion) | modify + test |
| T8 | Three.js hygiene | `components/scene/AgentGraph.tsx` | modify |
| T9 | Drift/hygiene | `package.json`, `scripts/fetch-github-stats.mjs`, `next.config.ts` | modify |

## 5. Sequencing + dependencies

Order T1→T9 (priority order). Each task is independent; no broken-window step. T1 first because it is the highest-impact fix and also proves the codex write-path as the loop's first tick.

## 6. Test strategy

| Success criterion | Verifier | Level |
|---|---|---|
| Drafts 404 in prod on all surfaces | `e2e/content-negotiation.spec.ts` (prod build), inverted-requirement check | e2e |
| Slug can't escape content dir | `lib/content.test.ts` traversal case | unit |
| CI enforces tests+coverage | `pnpm test:coverage` step in `ci.yml`; green locally | CI |
| Per-page OG present | metadata assertion; `grep openGraph app/` per route | e2e/static |
| Gates fail on inverted requirement | canvas/home spec assertions; Axe step can fail | e2e/CI |
| lib edges handled | fail-before/pass-after unit tests | unit |
| Security headers present | header assertion | e2e |
| WebGL context + DPR | orchestrator review (no reliable headless e2e) | review |
| No unused dep / false claim / stale comment | `pnpm typecheck`; targeted `rg` | static |

## 7. Rollout plan

Land on `feature/audit-remediation-2`; stop at process-gate MERGEABLE + opened PR. No runtime flags. Rollback = git revert.

## 8. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Codex edit lands wrong / no diff | low | med | Serial loop, per-task diff review, `no_progress_iterations: 2` halt |
| CSP breaks analytics/fonts/hydration | med | med | Conservative allowlist, verify render before commit |
| Draft gate 404s a wanted post | low | low | Matches current HTML behavior; publishing is separate |

## 9. Decisions log

- **Decision:** 404-gate drafts on `.md` + OG surfaces rather than filter at `getAllPosts`. **Why:** matches the HTML page's existing guard; smallest, most local change. **Rejected:** central slug-set filtering (larger blast radius).
- **Decision:** Hold `reel`-field deletion and any draft *publishing* out of the loop. **Why:** content edits are editorial per CLAUDE.md. **Rejected:** letting codex decide.
- **Decision:** codex-worker (gpt-5.6-sol) implements every task; orchestrator gates. **Why:** operator asked to use codex wherever possible; executor-node routing per CLAUDE.md. **Rejected:** orchestrator self-implements.

## 10. Out of scope (deferred)

- Publishing drafts; `reel` field rewiring; `/api/mcp`; Three.js replacement.

---

## Review checklist

- [x] Every file in the change list has a purpose
- [x] Sequencing leaves the tree buildable at every step
- [x] Each success criterion has a test
- [x] Schema changes N/A
- [x] API changes listed as route-boundary behavior
- [x] At least one trade-off in the decisions log
- [x] Rollout plan concrete
- [x] Out-of-scope listed
- [x] No ADR contradicted
