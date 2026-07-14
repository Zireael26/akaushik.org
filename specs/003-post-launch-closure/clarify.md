# Clarify: Post-launch follow-up closure

**Date:** 2026-07-14
**Operator request (verbatim):** “Take up all of the follow-ups and finish them. Use multiple sub-agents, workflows, loops, whatever you need to get maximum parallelization for this work, and wrap it all up.”

## 1. Intent

**Question:** What problem are we solving and why now?

**Hypothesis (0.95):** The portfolio has accumulated a mixed set of post-launch follow-ups: some are shipped-but-stale bookkeeping, some are executable engineering work, and some are owner-only/editorial tasks. The goal is to close every executable follow-up now, produce honest dispositions for the rest, and leave no ambiguous “pending” engineering residue.

**Answer:** Operator delegated the full current follow-up backlog for autonomous closure. “Finish” means implement and verify the engineering work, reconcile stale artifacts, and explicitly classify anything that cannot safely be completed without external credentials or unrecorded facts. It does not authorize invented client outcomes or silent external-account changes.

## 2. Users affected

**Question:** Who triggers this, depends on it, or notices failure?

**Hypothesis (0.9):** Abhishek, portfolio visitors, agent/crawler consumers, and future coding agents.

**Answer:** Abhishek depends on a truthful, low-maintenance portfolio. Human visitors depend on accurate case-study and availability claims. Agents and crawlers depend on working MCP/Markdown/discovery contracts. Future coding agents depend on ROADMAP, primers, specs, and follow-up ledgers matching the implementation.

## 3. Success metric

**Question:** How will we know this worked?

**Hypothesis (0.95):** All actionable follow-ups are either shipped with tests and production evidence or closed with a named, evidence-backed disposition; project gates pass and `main` is clean after ordered PR merges.

**Answer:** Success is falsifiable: MCP initialize/tools/list/tools/call works; Wanderer mounts only under the decided policy and passes motion/accessibility checks; ClusterBid surfaces contain no placeholders and expose only corroborated claims; the full Playwright matrix runs locally or has a concrete environment receipt; live agent-readiness/CSP/SEO/bundle evidence is refreshed; stale checkboxes and primers are reconciled; typecheck, lint, coverage, build, E2E, security gate, and process gate pass; PRs merge in dependency order and `main` ends clean.

## 4. Edge cases

**Question:** What inputs, states, or timings make this hard?

**Hypothesis (0.9):** Draft leakage, unknown MCP methods, nonce-CSP dynamic rendering, reduced-motion/mobile scene policy, unavailable browsers, missing media, and unverified editorial facts.

**Answer:** Preserve production draft gates; MCP must reject malformed/unknown requests without exposing drafts; nonce CSP must continue to hydrate; Wanderer must not run on mobile or reduced motion; browser installers may hang; reel renders may be expensive or unavailable; ClusterBid claims must be checked against the owner-authored historical draft and the current ClusterBid repository, with no invented outcomes; owner-only SEO/dashboard/social actions stay explicitly external.

## 5. Rollback plan

**Question:** How do we undo a bad result?

**Hypothesis (0.95):** Separate commits/PRs by subsystem and ordinary git revert; keep drafts gated until the last verified step.

**Answer:** Use isolated, subsystem-scoped commits and dependency-ordered PRs. MCP can be withdrawn by reverting its route/card commit. Wanderer can be disabled by reverting its mount commit while preserving source. ClusterBid remains `draft: true` until every surface and claim is verified, so rollback before publication is a no-op; after publication, revert the publication commit. Documentation/evidence changes are ordinary reverts. No migrations or external data writes are introduced.

## Convergence

The five answers align: this is a bounded post-launch closure bundle, not an invitation to execute long-horizon SEO campaigns or mutate owner accounts. The operator explicitly delegated implementation and requested maximum parallelization; proceed to spec without further interview.
