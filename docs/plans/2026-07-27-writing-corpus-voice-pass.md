# Writing corpus voice pass

**Date:** 2026-07-27
**Scope:** `content/writing/*.mdx`

## Decision

Review the complete writing corpus after correcting the GPTx article. Apply
the same voice standard without turning old posts into new articles or
rewriting historical claims.

The pass is deliberately prose-only:

- keep titles, dates, URLs, measurements, and technical conclusions intact;
- correct the Trellis boundary wherever needed: Trellis is the control plane
  around registered projects, while Claude Code and Codex own their sessions;
- remove dash-heavy sentence scaffolding and label-first bullet patterns that
  make otherwise concrete writing feel generated;
- replace vague filler only when a more exact verb is already supported by the
  sentence; and
- preserve deliberate first-person judgements, dry lines, and receipts.

## Review result

Four published posts and the draft fixture already passed the current writing
checks unchanged. Nine older published posts needed a narrow voice pass. The
direct-link-only incident post and the corrected GPTx post remain unchanged
after this audit.

## Verification

Every file under `content/writing/` must pass:

```sh
core-rules/skills/writing/scripts/check-writing.sh --blog <file>
```

The site must also pass typecheck, lint, unit tests, production build, and the
repository process gate before publication.
