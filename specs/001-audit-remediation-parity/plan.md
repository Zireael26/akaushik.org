# Plan: Audit Remediation Parity

**Slug:** `audit-remediation-parity`
**Date:** 2026-07-04
**Spec:** `specs/001-audit-remediation-parity/spec.md`
**Status:** accepted

---

## 1. Technical approach

Treat the audit as a remediation bundle with five implementation slices: supply-chain/security, framework/test quality, Trellis gates, documentation/spec parity, and primer parity. The code slice stays narrow: keep current UX, preserve agent-readiness routing, and replace placeholders with existing low-risk behavior rather than adding new products.

Security remediation uses normal package upgrades first, then narrow pnpm overrides only for vulnerable transitive packages that upstream packages still allow. SAST noise from `_reference/` is handled by scanner scope because the project rules mark that directory read-only archive.

The Next.js warning is fixed by migrating the request boundary from `middleware.ts` to `proxy.ts` and renaming the export to `proxy`, preserving the existing matcher and Link/content-negotiation helpers.

## 2. Data model + schema changes

No schema changes.

## 3. API surface

No new public API routes. Existing content-negotiation behavior must remain:

| Surface | Shape | Required behavior |
|---|---|---|
| `proxy.ts` | Next.js request boundary | Attach discovery/security headers and rewrite Markdown alternates exactly as `middleware.ts` did. |
| `/work/<slug>.md`, `/writing/<slug>.md` | Markdown alternates | Continue rewriting to `/md` route handlers. |
| `Accept: text/markdown` | Header negotiation | Continue returning Markdown for home and content pages when Markdown is the preferred type. |

## 4. File-by-file change list

| # | File | Action | Purpose |
|---|---|---|---|
| 1 | `specs/001-audit-remediation-parity/spec.md` | modify | Accepted audit-remediation spec. |
| 2 | `specs/001-audit-remediation-parity/plan.md` | new | Technical plan for this remediation. |
| 3 | `specs/001-audit-remediation-parity/tasks.md` | new | Check-boxed implementation breakdown. |
| 4 | `specs/001-audit-remediation-parity/analyze.md` | new | Pre-implementation drift check. |
| 5 | `package.json` | modify | Upgrade affected toolchain packages and add narrow overrides. |
| 6 | `pnpm-lock.yaml` | modify | Lock dependency remediation. |
| 7 | `.npmrc` / `pnpm-workspace.yaml` | modify | Make pnpm supply-chain settings explicit. |
| 8 | `.github/workflows/*.yml` | modify | Pin active GitHub Actions to commit SHAs. |
| 9 | `.semgrepignore` | new | Exclude read-only archive from active SAST scope. |
| 10 | `proxy.ts` | new | Next.js 16 request-boundary convention replacing middleware. |
| 11 | `middleware.ts` | delete | Remove deprecated file convention after proxy migration. |
| 12 | `app/layout.tsx` | modify | Add scroll-behavior marker and keep TweakBridge mount explicit. |
| 13 | `components/dev/TweakBridge.tsx` | modify | Replace wildcard postMessage with configured/same-origin messaging and origin checks. |
| 14 | `components/scene/AgentGraph.tsx` / `components/scene/WandererCrane.tsx` | modify | Replace deprecated `THREE.Clock` usage. |
| 15 | `components/sections/Contact.tsx` | modify | Replace `href="#"` booking CTA with email fallback. |
| 16 | `playwright.config.ts` | modify | Rename mobile project to match WebKit-backed iPhone device. |
| 17 | `eslint.config.js` | modify | Ignore generated coverage output. |
| 18 | `.agents/skills/process-gate-local/*` / `.claude/skills/process-gate-local/*` | modify/new | Add real `web-next` stack validators for both harnesses. |
| 19 | `README.md`, `CLAUDE.md`, `docs/PRD.md`, `docs/DESIGN_DIRECTION.md`, `docs/ROADMAP.md`, `docs/BUNDLE_BUDGET.md`, `docs/AGENT_READINESS.md`, `docs/seo/STATUS.md`, `docs/RELEASE_SCHEDULE.md`, `docs/CHANGELOG.md`, `lighthouserc*.yml`, selected E2E comments | modify | Reconcile stale specs/docs with implementation. |
| 20 | `docs/bundle-snapshots/2026-07-04-bundle.md` | new | Current Lighthouse/bundle snapshot from the audit. |
| 21 | `.claude/primers/*.md`, `.claude/primers/INDEX.md`, `.agents/primers/*` | modify/new | Refresh primer facts and restore Codex primer parity. |
| 22 | `audits/2026-07-04-baseline-akaushik.org.*` | modify/regenerate | Keep security baseline evidence current after remediation. |

## 5. Sequencing + dependencies

Order above is the implementation order. The only temporary broken window is the proxy rename: `proxy.ts` must be created and `middleware.ts` removed in the same edit so Next does not run both request-boundary files.

## 6. Test strategy

| Spec success criterion | Test name | Level | Fixture |
|---|---|---|---|
| Dependency/security audit passes | `pnpm audit --audit-level=moderate`; `pnpm audit --prod --audit-level=low`; security-gate baseline | supply-chain/security | Updated lockfile and audit baseline |
| Security findings reduced/scoped | security-gate baseline and Semgrep output | SAST/SCA | Active source tree, `_reference/` excluded |
| Quality warnings fixed/documented | `pnpm typecheck`; `pnpm lint`; `pnpm test`; `pnpm test:coverage`; `pnpm build` | local CI | Next.js app |
| Docs/specs reflect implementation | project-local `web-next` stack validator and targeted `rg` checks | static gate | README/docs/primers/specs |
| Primer parity | project-local `web-next` stack validator | static gate | `.claude/primers` and `.agents/primers` |
| Process-gate validator exists | Trellis aggregate `run-all.sh --mode=merge` | process gate | Local validator config |
| Pipeline artifacts trace work | `specs/001-audit-remediation-parity/analyze.md` | artifact review | Spec/plan/tasks triad |

## 7. Rollout plan

Ship directly on merge; no runtime flagging. The only behavior changes are safer edit-mode messaging, `proxy.ts` replacing `middleware.ts`, and the contact CTA email fallback. Dependency and workflow changes are covered by CI.

## 8. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Transitive override breaks dev tooling | med | med | Run install, typecheck, lint, tests, coverage, build, audit. |
| Proxy migration breaks Markdown negotiation | low | high | Run content-negotiation and agent-readiness E2E tests. |
| Action SHA pinning becomes stale | med | low | Comment source tags and leave upgrade path in CHANGELOG. |
| Primer parity creates duplicate stale surfaces | med | med | Use symlinked or mirrored Codex primer files and validate parity. |

## 9. Decisions log

- **Decision:** Use email fallback for the booking CTA.
  - **Why:** The audit only proves `href="#"` is wrong; no real calendar URL is available in repo context.
  - **Rejected:** Inventing a Calendly/Cal.com URL.
- **Decision:** Scope `_reference/` out of SAST rather than edit archived files.
  - **Why:** Project rules mark `_reference/` as scratchpad/archive and read-only in normal work.
  - **Rejected:** Mutating prototype JavaScript and archived workflows.
- **Decision:** Add a project-local validator rather than patch canonical process-gate.
  - **Why:** This repo can close its empty-validator gap without changing Trellis for every project.
  - **Rejected:** Editing inherited canonical scripts inside the project branch.

## 10. Out of scope (deferred)

- Replacing Three.js to hit the 150 KiB aspirational JS target.
- Publishing existing draft content.
- Implementing `/api/mcp`.

---

## Review checklist

- [x] Every file in the change list has a one-line purpose
- [x] Sequencing leaves the tree buildable at every step or names the broken-window step
- [x] Each spec success criterion has a corresponding test in the strategy section
- [x] Schema changes are not applicable
- [x] API changes are listed as route-boundary behavior
- [x] At least one explicit trade-off appears in the decisions log
- [x] Rollout plan is concrete
- [x] Out-of-scope items are listed
- [x] No ADRs are contradicted
