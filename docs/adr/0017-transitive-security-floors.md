# ADR-0017 — Transitive dependency security floors

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Abhishek and Codex

## Context

The pnpm graph retained vulnerable `brace-expansion` resolutions in two
compatibility branches and an older PostCSS patch. Direct application APIs do
not control those transitive selections, while the parent ranges accept the
patched versions.

## Decision

Align direct and transitive PostCSS to 8.5.13 and apply branch-scoped pnpm
overrides for `brace-expansion` 1.1.16 and 5.0.7. Reassess the overrides on
parent dependency upgrades and remove them once the resolver selects equal or
newer patched releases naturally.

## Consequences

- Frozen installs produce an advisory-clean dependency graph.
- Compatibility branches are kept separate rather than forced across majors.
- Dependency refreshes must run the package-manager audit and project gate.

## Reversal cost

Low. Remove a redundant override, regenerate the lock, and repeat the frozen
install, audit, test, and build receipts.
