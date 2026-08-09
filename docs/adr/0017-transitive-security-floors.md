# ADR-0017 — Transitive dependency security floors

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Abhishek and Codex

## Context

The pnpm graph retained vulnerable `brace-expansion` resolutions in two
compatibility branches and older `js-yaml`, Nano ID, PostCSS, and Sharp patches.
Direct application APIs do not control those transitive selections. The parent
ranges accept the patched releases except for Next.js 16.2.12's optional Sharp
range, which stops at `0.34.x` while the inherited libvips advisories require
Sharp `0.35.x`.

## Decision

Align direct and transitive PostCSS to 8.5.23 and apply branch-scoped pnpm
overrides for `brace-expansion` 1.1.18 and 5.0.9, `js-yaml` 4.3.1, Nano ID
3.3.17, and Sharp 0.35.3. The Sharp override is an intentional one-minor jump
outside Next.js's declared optional range; the production build is its
compatibility gate. Reassess the overrides on parent dependency upgrades and
remove them once the resolver selects equal or newer patched releases naturally.

## Consequences

- Frozen installs produce an advisory-clean dependency graph.
- Compatibility branches are kept separate rather than forced across majors.
- Sharp's temporary range exception is load-bearing and must keep passing the
  production image-optimization build before release.
- Dependency refreshes must run the package-manager audit and project gate.

## Reversal cost

Low. Remove a redundant override, regenerate the lock, and repeat the frozen
install, audit, test, and build receipts.
