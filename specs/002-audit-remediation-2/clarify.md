# Clarify: Audit Remediation 2

**Slug:** `audit-remediation-2`
**Date:** 2026-07-13
**Source audit:** dynamic workflow `wf_82a2ef9d-7c6` (9 gpt-5.6-sol finders + Claude adversarial verify), 28 confirmed findings. Report: `audits/2026-07-13-audit.md`.

## Intake Q&A

- **Intent** — Remediate the 28 adversarially-confirmed findings from the 2026-07-13 audit. Highest-impact: draft/unpublished content served in production via the Markdown + OG-image content-negotiation routes.
- **Scope (operator, 2026-07-13)** — Fix **all P1–P3** (T1–T9). Two items held out of the automated loop as editorial.
- **Delivery (operator, 2026-07-13)** — **Spec-002 triad → single branch → one PR.** Diff exceeds the 400-line surgical floor, so a spec triad is required by the mandatory pipeline.
- **Draft-gate intent (default, operator did not override)** — Current `draft: true` posts are **404-gated in production**, not published. Publishing any specific draft is separate editorial work.
- **Success metric** — All nine tasks land with fail-before/pass-after verifiers; process-gate MERGEABLE; PR opened (no merge to main).
- **Edge cases** — Draft routes must 404 in prod but still render in dev; slug sanitization must not break valid slugs; new CI test step must not double-run or flake.
- **Rollback** — Ordinary `git revert` of the branch; no migrations, flags, or external state.

## Held out of the codex loop (editorial — operator decides separately)

- Deleting the dead `reel` frontmatter field (touches 4 `content/case-studies/*.mdx` — content is deliberate editorial per CLAUDE.md).
- Whether any specific draft post should be *published* rather than merely 404-gated.
