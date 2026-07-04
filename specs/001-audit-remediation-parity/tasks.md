# Tasks: Audit Remediation Parity

**Slug:** `audit-remediation-parity`
**Date:** 2026-07-04
**Spec:** `specs/001-audit-remediation-parity/spec.md`
**Plan:** `specs/001-audit-remediation-parity/plan.md`
**Status:** done

---

## Working contract

- This file is the source of truth for the feature's work breakdown.
- Tick the checkbox here when the task has local verification evidence.
- Each task is scoped to at most four hours.

---

## Tasks

| ID | Task | Est. | Depends | Covers (spec §3 criterion) | Status |
|----|------|------|---------|------|--------|
| T1 | Add `specs/001-audit-remediation-parity/*` pipeline artifacts. | ~1h | — | Pipeline artifacts trace work | [x] |
| T2 | Update `package.json`, `pnpm-lock.yaml`, `.npmrc`, and `pnpm-workspace.yaml` for dependency and supply-chain audit remediation. | ~3h | T1 | Dependency/security audit passes; security findings reduced/scoped | [x] |
| T3 | Pin active `.github/workflows/*.yml` actions and add `.semgrepignore` for read-only archive scope. | ~2h | T1 | Security findings reduced/scoped | [x] |
| T4 | Replace `middleware.ts` with `proxy.ts` and preserve Markdown/Link-header behavior. | ~2h | T1 | Quality warnings fixed/documented; docs/specs reflect implementation | [x] |
| T5 | Harden `components/dev/TweakBridge.tsx`, update `app/layout.tsx`, replace deprecated Three.js clocks, fix the contact CTA, and align Playwright/ESLint config. | ~4h | T1 | Security findings reduced/scoped; quality warnings fixed/documented | [x] |
| T6 | Add project-local `web-next` validators under `.agents/skills/process-gate-local/` and `.claude/skills/process-gate-local/`. | ~2h | T2, T3, T4, T5 | Process-gate validator exists; docs/specs reflect implementation | [x] |
| T7 | Refresh README, CLAUDE, PRD, design, roadmap, bundle, agent-readiness, SEO status, release schedule, Lighthouse comments, CHANGELOG, and bundle snapshot docs. | ~4h | T2, T3, T4, T5 | Docs/specs reflect implementation | [x] |
| T8 | Refresh `.claude/primers/*` and restore `.agents/primers/*` parity. | ~3h | T7 | Primer parity | [x] |
| T9 | Regenerate `audits/2026-07-04-baseline-akaushik.org.*` and run Trellis/project verification commands. | ~4h | T2, T3, T4, T5, T6, T7, T8 | All criteria | [x] |

## Coverage map

| Spec criterion | Covering tasks |
|---|---|
| `pnpm audit --audit-level=moderate` passes, and production audit has no known low-or-higher finding from this remediation set. | T2, T9 |
| Security baseline raw findings are reduced or explicitly scoped so active source has no untriaged mutable-action, wildcard-postMessage, stale archive, or dependency findings from the audit. | T2, T3, T5, T9 |
| Next.js, lint, test, and E2E configuration warnings from the audit are either fixed or documented as deliberate constraints with verifier coverage. | T4, T5, T7, T9 |
| Current docs/specs reflect the implemented state: canonical domain/robots status, raw Three.js hero, current bundle measurements, proxy file convention, deferred editorial work, and non-placeholder contact behavior. | T7, T9 |
| Claude and Codex primer surfaces expose the same relevant primers, and edited primers reflect this remediation. | T8, T9 |
| Project-local process-gate has a real `web-next` stack validator instead of an empty validator list. | T6, T9 |
| Trellis pipeline artifacts (`spec.md`, `plan.md`, `tasks.md`, `analyze.md`) exist and trace every implementation task back to these criteria. | T1, T9 |

## Follow-ups (discovered during implementation)

- Local full `pnpm test:e2e` matrix needs the Playwright Firefox/WebKit cache repaired on this machine. `pnpm exec playwright install firefox` and `pnpm exec playwright install webkit` both reached 100% download but hung in the browser download helper; focused Chromium desktop/tablet E2E and production curl/screenshot checks passed.

## Done criteria

- [x] Every task above is checked.
- [x] Every spec success criterion has a passing local verifier.
- [x] Process-gate verdict is MERGEABLE.
- [x] Security baseline is regenerated after remediation.
- [x] Status field above is updated to `done`.

---

## Status updates

- 2026-07-04: created from `plan.md`, 0/9 tasks complete.
- 2026-07-04: remediation implemented and verified; 9/9 tasks complete, security baseline clean, process gate MERGEABLE.
