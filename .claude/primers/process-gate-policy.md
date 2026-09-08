---
slug: process-gate-policy
purpose: Pre-commit hook enforcing CHANGELOG / ADR / ROADMAP coupling for code, structural, and EPM changes; bypassed only via SKIP_PROCESS_GATE.
pinned_to: 52424a1
created: 2026-05-15
last_refreshed: 2026-07-04
related_primers: []
---

# Process Gate Policy

## Purpose

Block commits that change code, project structure, or EPM docs without the paired documentation update (CHANGELOG entry, ADR, or ROADMAP edit). Keeps the project's "every meaningful change leaves a paper trail" rule mechanically enforced rather than reviewer-trusted.

## Entry points

- `.husky/pre-commit` — shell entry point. Runs `lint-staged` (when available), then `pnpm run process:check` if the script exists.
- `scripts/process-gate.mjs` — the gate itself. Reads staged paths via `git diff --cached --name-only --diff-filter=ACMRD`, evaluates three rules, exits 0/1/2.
- `package.json` — registers `"process:check": "node scripts/process-gate.mjs"`. Pre-push and CI hooks reuse the same script with `PROCESS_GATE_DIFF_BASE=origin/main`.
- `docs/adr/0002-process-gate-policy.md` — the canonical policy spec. Read this before changing rule semantics.
- `docs/adr/0009-se-core-onboarding-husky-vitest.md` — context on Husky + Trellis inheritance for this gate.
- `.agents/skills/process-gate-local/validate-web-next.sh` and `.claude/skills/process-gate-local/validate-web-next.sh` — Trellis-local web validator for this repo's dependency, security, proxy, and doc-contract drift checks.

## Data flow

A representative `git commit` invocation:

1. Husky fires `.husky/pre-commit`. `set -e` makes any failure abort the commit.
2. The hook runs `./node_modules/.bin/lint-staged` if installed (formatters, linters), then probes `package.json` for `process:check`.
3. `pnpm run process:check` invokes `scripts/process-gate.mjs`. If `SKIP_PROCESS_GATE=1` is set, the script logs a bypass warning and exits 0 immediately.
4. The script collects staged file paths. `PROCESS_GATE_DIFF_BASE` (set in CI) swaps the staged diff for `${base}..HEAD`, so the same policy runs on PR branches without changing the rule code.
5. Rules evaluate against the path list:
   - **R1:** any path under `app/`, `components/`, `lib/`, `scripts/`, or `content/` requires `docs/CHANGELOG.md` to also be staged.
   - **R2:** changes to `next.config.*`, `proxy.ts`, `package.json`, `tsconfig.json`, or `eslint.config.*` require either a new ADR (`docs/adr/####-…md`) or a CHANGELOG entry.
   - **R3:** changes under `docs/epm/` require `docs/ROADMAP.md` to be staged.
6. Violations print `R<n>: …` messages and exit 1; otherwise the script logs `process-gate: N staged file(s) — OK.` and exits 0. The hook propagates the exit code to git, which aborts or completes the commit accordingly.

## Dependencies

- `git` — the only data source. The gate trusts the index, not the working tree.
- `node:child_process` (`execFileSync`) — runs the git invocation.
- Husky ≥9 — installs `.husky/pre-commit` and wires git hooksPath. `pnpm prepare` (run on install) bootstraps Husky.
- `lint-staged` — optional sibling formatter step. The hook checks for its binary before invoking; absence is non-fatal.
- GitHub branch protection on `main` — server-side, not a file in this repo. Blocks direct push, requires a PR, and requires the `verify`, `test`, and `audit` checks green (strict, admins included). Out of scope here.

## Test commands

```bash
# Dry-run against the current staged set
pnpm run process:check

# Simulate CI mode (diff a branch against main rather than the index)
PROCESS_GATE_DIFF_BASE=origin/main pnpm run process:check

# Project-local Trellis validator
bash .agents/skills/process-gate-local/validate-web-next.sh --range=origin/main..HEAD

# Emergency bypass — logs a warning, exits 0
SKIP_PROCESS_GATE=1 pnpm run process:check

# Force the hook to run (without committing)
.husky/pre-commit
```

To exercise an end-to-end failure: stage a `.ts` file under `app/` without touching `docs/CHANGELOG.md` and run `pnpm run process:check`. Expect exit 1 and an `R1:` line.

## Gotchas

- **`SKIP_PROCESS_GATE=1` is logged, not silent.** The bypass writes to stderr, so the audit trail captures every emergency commit. Don't try to hide it.
- **R2 accepts CHANGELOG-only when an ADR already exists.** The rationale is in ADR-0002: tiny structural follow-ups (e.g. a `tsconfig` `moduleResolution` tweak) shouldn't force a new ADR if the entry references an existing ADR number. The CHANGELOG copy itself isn't grepped for the ADR reference — that's reviewer discipline.
- **R1 fires on `content/` too.** MDX edits count as code-equivalent because they ship as content. A typo fix in `content/writing/foo.mdx` needs a CHANGELOG line, same as any code edit.
- **`lint-staged` is missing from `devDependencies`.** The `.husky/pre-commit` checks `./node_modules/.bin/lint-staged` and logs `not installed - skipping` if absent — verified by reading the hook. If formatter enforcement is desired, install it explicitly.
- **Diff filter `ACMRD` excludes type-change-only entries (`T`)** and unmerged paths (`U`). Realistic edge case: a symlink swap won't trigger the gate. Not currently a concern — flag it if symlinks enter `app/`.
- **The hook runs at the canonical repo root**, not in worktrees individually — Husky resolves via `git --git-common-dir`. Worktree commits still trigger the gate.
- **Exit code 2 means invocation error**, not a policy violation. If `git diff` itself fails, the gate fails-closed; check `git status`.

## Out of scope

- Push-time guards. Direct push to `main` is refused by GitHub branch protection, server-side — there is no pre-push hook in this repo to read or bypass. Separate mechanism, separate concern.
- CI-side checks beyond reuse of the same script — see `.github/workflows/` if CI starts emitting different verdicts than the local hook.
- Doc content quality (CHANGELOG style, ADR template adherence) — the gate only checks that the file is staged, not what it says.

## Notes

- The policy as written assumes solo-author workflow. Multi-author scenarios (rebases, cherry-picks across branches) might surface friction; revisit when a collaborator joins.
- If a new top-level code directory lands (e.g. `app/(marketing)/…` patterns or a new `workers/` dir), update the `CODE_PATHS` regex in `scripts/process-gate.mjs` and document in CHANGELOG. The gate fails open on uncovered paths.
