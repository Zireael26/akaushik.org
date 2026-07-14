# Tasks: Close the live post-launch backlog

**Spec:** `specs/003-post-launch-closure/spec.md`
**Plan:** `specs/003-post-launch-closure/plan.md`
**Status:** accepted
**Slicing strategy:** contract-first fan-out, followed by an evidence/merge integration slice

## Work breakdown

| ID | Task | Depends | Estimate | Spec coverage |
|---|---|---|---:|---|
| T1 | [ ] Add the stable MCP protocol core and draft-safe tools in `lib/mcp.ts`, `lib/mcp.test.ts`, and `app/api/mcp/route.ts`. | — | ~3.5h | SC1 |
| T2 | [ ] Advertise and verify MCP in `public/.well-known/mcp.json`, `lib/openapi-spec.ts`, `app/api/docs/page.tsx`, `app/llms.txt/route.ts`, `docs/AGENT_READINESS.md`, `e2e/mcp.spec.ts`, and `e2e/agent-readiness.spec.ts`. | T1 | ~3h | SC1, SC2 |
| T3 | [ ] Restore desktop-only Wanderer behavior in `app/layout.tsx`, `components/scene/Wanderer.tsx`, `components/scene/Wanderer.module.css`, `components/scene/WandererCraneClient.tsx`, `components/scene/WandererCrane.tsx`, `e2e/canvas.spec.ts`, and `e2e/reduced-motion.spec.ts`. | — | ~3.5h | SC3 |
| T4 | [ ] Publish the corroborated ClusterBid case study and all consumers in `content/case-studies/clusterbid.mdx`, `components/sections/Work.tsx`, `components/work/reels.tsx`, `app/api/case-studies/route.ts`, `app/llms-full.txt/route.ts`, `lib/content.test.ts`, `e2e/work.spec.ts`, `docs/PRD.md`, and `docs/CASE_STUDIES_OUTLINE.md`. | — | ~4h | SC4 |
| T5 | [ ] Repair small-screen navigation, stale technology copy, and detail-page breadcrumbs in `components/site/SiteNav.tsx`, `components/sections/Hero.tsx`, `app/globals.css`, `lib/structured-data.ts`, `lib/structured-data.test.ts`, `app/work/[slug]/page.tsx`, `app/work/[slug]/page.test.ts`, `app/writing/[slug]/page.tsx`, `app/writing/[slug]/page.test.ts`, and `e2e/home.spec.ts`. | — | ~3.5h | SC11, SC12 |
| T6 | [ ] Harden runtime and automation in `package.json`, `pnpm-lock.yaml`, `.github/workflows/stats.yml`, `scripts/check-production.mjs`, `.github/workflows/production-smoke.yml`, `public/favicon.svg`, and `public/favicon.ico`. | — | ~4h | SC8, SC9, SC10 |
| T7 | [ ] Install and prove the Playwright browser matrix, correct primer paths in `.claude/primers/` and `.agents/primers/`, roll out `.agents/skills/writing/`, and update `playwright.config.ts` plus `docs/adr/0005-playwright-over-cypress.md`. | — | ~3h | SC5 |
| T8 | [ ] Reconcile shipped and historical status in `docs/adr/0007-r3f-9-bump.md`, `docs/adr/0015-post-launch-runtime-and-bundle-budget.md`, `docs/BUNDLE_BUDGET.md`, `docs/ROADMAP.md`, `docs/wanderer-redesign-brief.md`, `docs/seo/STATUS.md`, `docs/seo/scheduled-tasks/seo-weekly-draft.md`, `docs/epm/EPIC-01-pixel-parity.md`, `specs/001-audit-remediation-parity/{spec,tasks}.md`, `specs/002-audit-remediation-2/{spec,tasks}.md`, `audits/2026-07-13-audit.md`, and `docs/CHANGELOG.md`. | T1, T2, T3, T4, T5, T6, T7 | ~4h | SC6, SC11 |
| T9 | [ ] Run analyzer, Lighthouse, Axe, routing, nonce-CSP/contact, MCP, favicon, and TTFB probes and record exact receipts in `docs/agent-readiness-snapshots/2026-07-14.md` and `docs/bundle-snapshots/2026-07-14-bundle.md`. | T2, T3, T4, T5, T6, T7 | ~4h | SC7, SC8, SC10, SC11 |
| T10 | [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`, `pnpm build`, the complete `pnpm test:e2e` matrix, Trellis security gate, and `pnpm process:check`; fix only in-scope regressions and tick completed receipts in `specs/003-post-launch-closure/tasks.md`. | T8, T9 | ~4h | SC13 |
| T11 | [ ] Run the process-gate skill on each exact subsystem branch, retain each receipt, push and merge the resulting pull requests in dependency order, disable Cloudflare Email Address Obfuscation, apply/verify protected `main`, dispatch the production smoke workflow, and verify clean deployed `main`. | T10 | ~3h | SC7, SC8, SC9, SC10, SC13 |

## Dependency order

```text
T1 ──> T2 ─┐
T3 ────────┤
T4 ────────┤
T5 ────────┼──> T8/T9 ──> T10 ──> T11
T6 ────────┤
T7 ────────┘
```

## Execution contract

- T1, T3, T4, T5, T6, and T7 have disjoint primary ownership and may run concurrently in isolated worktrees.
- T2 starts as soon as T1's protocol contract is available.
- Only T8 edits central status ledgers; implementation lanes must report evidence instead of touching those files.
- Only verified tasks are ticked. A host/control-plane failure keeps the affected task open with the exact receipt.
- ClusterBid remains draft-gated until T4's content, surface, and browser checks are green.

## Coverage audit

- SC1: T1, T2
- SC2: T2
- SC3: T3
- SC4: T4
- SC5: T7
- SC6: T8
- SC7: T9, T11
- SC8: T6, T9, T11
- SC9: T6, T11
- SC10: T6, T9, T11
- SC11: T5, T8, T9
- SC12: T5
- SC13: T10, T11
