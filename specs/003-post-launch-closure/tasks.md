# Tasks: Close the live post-launch backlog

**Spec:** `specs/003-post-launch-closure/spec.md`
**Plan:** `specs/003-post-launch-closure/plan.md`
**Status:** accepted for repository integration; T12 control-plane mutations held pending explicit operator confirmation
**Slicing strategy:** contract-first fan-out, followed by an evidence/merge integration slice

## Work breakdown

| ID  | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Depends                             | Estimate | Spec coverage                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------: | ------------------------------ |
| T1  | [x] Add current/prior/fallback MCP negotiation, transport validation, draft-safe tools, and protocol-correct errors in `lib/mcp.ts`, `lib/mcp.test.ts`, `lib/mcp-http.ts`, and `app/api/mcp/route.ts`.                                                                                                                                                                                                                                                                                                                                        | —                                   |    ~3.5h | SC1                            |
| T2  | [x] Advertise and verify MCP in `public/.well-known/mcp.json`, `lib/openapi-spec.ts`, `app/api/docs/page.tsx`, `app/llms.txt/route.ts`, `docs/AGENT_READINESS.md`, `e2e/mcp.spec.ts`, and `e2e/agent-readiness.spec.ts`.                                                                                                                                                                                                                                                                                                                  | T1                                  |      ~3h | SC1, SC2                       |
| T3  | [x] Restore home-only desktop Wanderer behavior in `app/layout.tsx`, `components/scene/Wanderer.tsx`, `components/scene/Wanderer.module.css`, `components/scene/WandererCraneClient.tsx`, `components/scene/WandererCrane.tsx`, `e2e/canvas.spec.ts`, and `e2e/reduced-motion.spec.ts`; attach desktop/mobile screenshots proving the visible/absent policy.                                                                                                                                                                              | —                                   |    ~3.5h | SC3                            |
| T4  | [x] Publish the corroborated ClusterBid case study and all consumers in `content/case-studies/clusterbid.mdx`, `components/sections/Work.tsx`, `components/work/reels.tsx`, `app/api/case-studies/route.ts`, `app/llms-full.txt/route.ts`, `app/llms.txt/route.ts`, `app/work/page.tsx`, `app/layout.tsx`, `app/opengraph-image.tsx`, `lib/content.test.ts`, `e2e/work.spec.ts`, `docs/PRD.md`, and `docs/CASE_STUDIES_OUTLINE.md`; attach the verified detail-page screenshot.                                                           | —                                   |      ~4h | SC4                            |
| T5  | [x] Repair small-screen navigation, stale technology copy, detail-page breadcrumbs, and JSON-LD nonce propagation in `components/site/SiteNav.tsx`, `components/sections/Hero.tsx`, `app/globals.css`, `lib/structured-data.ts`, `lib/structured-data.test.ts`, `components/seo/JsonLdScript.tsx`, `components/seo/JsonLdScript.test.tsx`, `app/work/[slug]/page.tsx`, `app/work/[slug]/page.test.ts`, `app/writing/[slug]/page.tsx`, `app/writing/[slug]/page.test.ts`, and `e2e/home.spec.ts`; attach 375px and desktop UI screenshots. | —                                   |    ~3.5h | SC8, SC11, SC12                |
| T6  | [x] Harden runtime and automation in `package.json`, `.nvmrc`, `pnpm-lock.yaml`, `.github/workflows/{stats,ci,e2e,lighthouse,production-smoke}.yml`, `scripts/check-production{,-lib,.test}.mjs`, `public/favicon.svg`, and `public/favicon.ico`.                                                                                                                                                                                                                                                                                         | —                                   |      ~4h | SC8, SC9, SC10                 |
| T7  | [ ] Install and prove the Playwright browser matrix, correct primer paths in `.claude/primers/` and `.agents/primers/`, roll out `.agents/skills/writing/`, correct the content root in `CLAUDE.md`/`AGENTS.md`, and update `playwright.config.ts` plus `docs/adr/0005-playwright-over-cypress.md`.                                                                                                                                                                                                                                       | —                                   |      ~3h | SC5                            |
| T8  | [x] Reconcile shipped and historical status in `docs/adr/0007-r3f-9-bump.md`, `docs/adr/0016-post-launch-runtime-and-bundle-budget.md`, `docs/BUNDLE_BUDGET.md`, `docs/ROADMAP.md`, `docs/wanderer-redesign-brief.md`, `docs/seo/STATUS.md`, `docs/seo/scheduled-tasks/seo-weekly-draft.md`, `docs/epm/EPIC-01-pixel-parity.md`, `specs/001-audit-remediation-parity/{spec,tasks}.md`, `specs/002-audit-remediation-2/{spec,tasks}.md`, `audits/2026-07-13-audit.md`, and `docs/CHANGELOG.md`.                                            | T1, T2, T3, T4, T5, T6, T7          |      ~4h | SC6, SC11                      |
| T9  | [ ] Run analyzer, Lighthouse, Axe, routing, nonce-CSP/contact, MCP, favicon, and TTFB probes and record exact receipts in `docs/agent-readiness-snapshots/2026-07-14.md` and `docs/bundle-snapshots/2026-07-14-bundle.md`.                                                                                                                                                                                                                                                                                                                | T2, T3, T4, T5, T6, T7              |      ~4h | SC7, SC8, SC10, SC11           |
| T10 | [ ] On the final stacked head, run `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`, `pnpm build`, the complete `pnpm test:e2e` matrix, Trellis security gate, and `pnpm process:check`; route fixes back to the owning lane before cutting exact branch refs and tick only completed receipts.                                                                                                                                                                                                                                        | T8, T9                              |      ~4h | SC13                           |
| T11 | [ ] Main orchestrator only: cut the exact linear branch heads, run the process gate on each, retain receipts, open PRs, and merge them in dependency order after green CI. Subagents stop at patch/proof/review and never merge.                                                                                                                                                                                                                                                                                                          | T10                                 |      ~3h | SC13                           |
| T12 | [ ] **Held pending explicit operator confirmation.** Main orchestrator only: capture pre-state, disable Cloudflare Email Address Obfuscation, create/verify the Vercel WAF `/api/mcp` 60/min/source + 60-second-block rule, and apply/verify protected `main`; retain reversal instructions and production receipts.                                                                                                                                                                                                                      | T11                                 |      ~2h | SC8, SC9                       |
| T13 | [ ] Dispatch the production-smoke workflow; run `@modelcontextprotocol/inspector@0.22.0` through initialize/initialized, `tools/list`, `lookup_case_study`, and `get_availability`; run browser probes; verify deployed `main`; and record the final clean-state receipt. Control-specific probes remain conditional on T12 authorization.                                                                                                                                                                                                | T11; T12 for control-specific proof |      ~2h | SC1, SC7, SC8, SC9, SC10, SC13 |

## Dependency order

```text
T1 ──> T2 ─┐
T3 ────────┤
T4 ────────┤
T5 ────────┼──> T8/T9 ──> T10 ──> T11
T6 ────────┤
T7 ────────┘

T11 ──> T13
T11 ──> T12 (held) ──> control-specific T13 proof
```

## Execution contract

- T1, T3, T4, T5, T6, and T7 have disjoint primary ownership and may run concurrently in isolated worktrees.
- T2 starts as soon as T1's protocol contract is available.
- Only T8 edits central status ledgers; implementation lanes must report evidence instead of touching those files.
- Only verified tasks are ticked. A host/control-plane failure keeps the affected task open with the exact receipt.
- ClusterBid remains draft-gated until T4's content, surface, and browser checks are green.
- The main orchestrator owns commits, PR creation, merges, and scoped control-plane writes under the operator's explicit ordered-merge/finish directive; subagents never cross those boundaries.
- T10 fixes must land in their owning lane before branch refs are cut. If a late fix is unavoidable, rebuild every dependent branch head and rerun its exact-head gate.

## Coverage audit

- SC1: T1, T2, T12, T13
- SC2: T2
- SC3: T3
- SC4: T4
- SC5: T7
- SC6: T8
- SC7: T9, T13
- SC8: T6, T9, T12, T13
- SC9: T6, T12, T13
- SC10: T6, T9, T13
- SC11: T5, T8, T9
- SC12: T5
- SC13: T10, T11, T13
