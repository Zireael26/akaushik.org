# Spec: Audit Remediation Parity

**Slug:** `audit-remediation-parity`
**Date:** 2026-07-04
**Author:** Codex
**Status:** accepted

---

## 1. Problem statement

The 2026-07-04 system audit found that the portfolio is buildable and operational, but the implementation, docs, security posture, Trellis gates, and primer surfaces have drifted from one another. That drift weakens the site's claim that process is part of the product: future agents see stale R3F and SEO guidance, security scans produce known findings, process-gate reports a stack profile pass without validators, and quality warnings are normalized instead of fixed.

## 2. Users + scenario

- **Abhishek** — wants a repo that can go through the Trellis process without re-litigating the audit findings by hand.
- **Future agents** — need specs, plans, primers, and project docs to match the implemented Next.js 16 / raw Three.js / agent-readiness state before making follow-on changes.
- **Reviewers** — need security and quality gates to produce high-signal findings rather than stale documentation or scanner noise.

## 3. Success criteria

- [ ] `pnpm audit --audit-level=moderate` passes, and production audit has no known low-or-higher finding from this remediation set.
- [ ] Security baseline raw findings are reduced or explicitly scoped so active source has no untriaged mutable-action, wildcard-postMessage, stale archive, or dependency findings from the audit.
- [ ] Next.js, lint, test, and E2E configuration warnings from the audit are either fixed or documented as deliberate constraints with verifier coverage.
- [ ] Current docs/specs reflect the implemented state: canonical domain/robots status, raw Three.js hero, current bundle measurements, proxy file convention, deferred editorial work, and non-placeholder contact behavior.
- [ ] Claude and Codex primer surfaces expose the same relevant primers, and edited primers reflect this remediation.
- [ ] Project-local process-gate has a real `web-next` stack validator instead of an empty validator list.
- [ ] Trellis pipeline artifacts (`spec.md`, `plan.md`, `tasks.md`, `analyze.md`) exist and trace every implementation task back to these criteria.

## 4. Non-goals

- Publishing draft MDX posts or the ClusterBid case study without editorial approval.
- Implementing the deferred MCP server at `/api/mcp`.
- Solving the remaining 150 KiB bundle aspiration by replacing Three.js; this pass refreshes measurements and keeps the overrun honest.
- Changing `_reference/` archive contents, except excluding it from active security-scan scope.

## 5. Constraints

- Follow parent Trellis rules and this repo's `CLAUDE.md`; multi-file edits must stay phased and verified.
- Content files under `content/` are deliberate editorial units; do not create or publish MDX content without asking.
- `_reference/` is read-only archive in normal work.
- Next.js 16 proxy migration must preserve existing Link headers and Markdown content-negotiation behavior.
- If no calendar URL is configured, the contact booking CTA must use a non-placeholder email fallback rather than inventing a scheduling provider URL.
- Security scan suppressions must be narrow and explainable; do not hide active-source findings by broad ignores.

## 6. Open questions

None as of 2026-07-04. Operator authorized autonomous implementation; the only product assumption is that "Book a 20-minute call" falls back to email until a real scheduling URL exists.

## 7. Risks

- Dependency overrides can force incompatible transitive versions; mitigated by full install, build, unit, coverage, and audit verification.
- Pinning GitHub Actions to SHAs can make future upgrades more manual; mitigated by comments identifying the source tag.
- Renaming `middleware.ts` to `proxy.ts` touches agent-readiness routing; mitigated by content-negotiation and agent-readiness E2E tests.
- Security-gate raw findings may remain for upstream-only advisories; mitigated by documenting any unavoidable upstream state explicitly in the audit report and plan.

## 8. Out of scope (intentional)

- External dashboard work: GSC/Bing verification, Wikidata creation, and scheduled-task registration stay human-owned.
- A new ADR for this remediation bundle. Existing ADRs govern the technical decisions; this spec records audit closure.
- PR creation, merge, or deployment. This pass stops at local implementation and process-gate readiness unless the operator asks to publish.

---

## Review checklist

- [x] Problem statement names a real pain, not a solution
- [x] Every success criterion is testable
- [x] At least one non-goal is listed
- [x] Constraints cite their source
- [x] Open questions are real questions, not placeholder TODOs
- [x] No implementation detail crept in beyond audit-scope constraints
- [x] Spec is readable in under 5 minutes
