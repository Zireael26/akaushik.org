# ADR-0001: Framework dependency baselines

## Status

Accepted

## Context

The August 2026 security audit requires coordinated Next.js, PostCSS, TypeScript,
and transitive dependency floors. Updating these independently can produce an
unsupported framework and toolchain combination.

## Decision

Keep Next.js and `eslint-config-next` on 16.3.x, PostCSS on 8.5.26 or newer,
and the supported TypeScript 6 lane. Maintain scoped package-manager overrides
for advisories that cannot be closed through direct dependency declarations.

## Consequences

Framework upgrades are reviewed as one lockfile change. Future updates must
preserve the supported version combination and may remove overrides once the
resolved graph no longer needs them.
